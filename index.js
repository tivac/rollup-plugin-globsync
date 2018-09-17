"use strict";

const path = require("path");

const match = require("multimatch");
const globby = require("globby");
const cp = require("cp-file");
const del = require("del");
const marky = require("marky");
const pretty = require("pretty-ms");

const CheapWatch = require("cheap-watch");

const log = require("npmlog");

// Wrapper around pretty-ms and marky.stop
const stop = (name) => pretty(marky.stop(name).duration);

module.exports = ({ patterns = [], dest = "./dist", options = false }) => {
    const {
        dir = process.cwd(),
        clean = true,
        verbose = false,
        loglevel = "info",
        transform = (file) => file
    } = options;
    
    log.level = verbose ? "verbose" : loglevel;

    const watch = Boolean(process.env.ROLLUP_WATCH);

    let runs = 0;

    marky.mark("generating globs");

    const globs = [
        // The worst dir for a watcher to walk, yikes
        "!**/node_modules/**",

        ...patterns
            // Filter out falsey values
            .filter(Boolean)
            // flatten one level deep
            .reduce((acc, val) => acc.concat(val), [])
            //make absolute paths relative so they match anything
            .map((item) => (
                path.isAbsolute(item) ?
                    `./${path.relative(dir, item).replace(/\\/g, "/")}` :
                    item
            )),
        
        // No inception, please
        `!./${path.relative(dir, dest)}/**`,
    ];

    log.silly("config", `Globs:\n${JSON.stringify(globs, null, 4)}`);
    log.silly("config", `Generating globs took ${stop("generating globs")}`);

    return {
        name : "globsync",

        buildStart() {
            if(runs++) {
                return;
            }

            // Just in case!
            marky.clear();
            
            marky.mark("setup");

            let booting = true;
            
            if(clean) {
                log.verbose("clean", `Cleaning ${dest}...`);
                marky.mark("cleaning");

                del.sync(dest);

                log.silly("clean", `Cleaning destination took ${stop("cleaning")}`);
            }
            
            log.silly("collect", `Collecting files...`);

            marky.mark("collecting");

            // Use globby to walk the FS and find all files matching globs
            // for use in cheap-watch's filter function since it'll need to know
            // to iterate intermediate directories and glob matchers aren't good at that bit
            const files = globby.sync(globs, { cwd : dir });

            log.silly("collect", `Done collecting files in ${stop("collecting")}`);

            // Don't want to make rollup wait on this, so wrapped in an async IIFE
            (async function() {
                log.silly("copy", "Initial copy starting...");

                marky.mark("copying");

                await files.forEach((file) => cp(file, path.join(dest, transform(file))));

                log.silly("copy", `Initial copy complete in ${stop("copying")}`);
            }());

            marky.mark("watcher init");

            // Don't want to make rollup wait on this, so wrapped in an async IIFE
            (async function() {
                if(!watch) {
                    return;
                }

                const watcher = new CheapWatch({
                    dir,
                    watch,

                    // Check paths iterated at startup and any newly created dirs/files
                    // to ensure that they should be handled
                    filter : ({ path : item }) => {
                        // Paper over differences between cheap-watch and globbers
                        const name = `./${item}`;

                        // During booting phase check against list from globby
                        if(booting) {
                            return files.some((file) => file.startsWith(name));
                        }

                        // after booting need to compare against the globs themselves
                        return match([ name ], globs).length > 0;
                    },
                });

                // Added or changed files/dirs
                watcher.on("+", async ({ path : item, stats }) => {
                    // Never want to copy just a directory, cp-file will create
                    // intermediate directories automatically anyways
                    if(stats.isDirectory()) {
                        return;
                    }

                    log.silly("change", `Copying ${item}...`);

                    marky.mark("copy");

                    await cp(path.join(dir, item), path.join(dest, transform(item)));

                    log.silly("change", `Copied in ${stop("copy")}`);
                });

                // Removed files/dirs
                watcher.on("-", async ({ path : item, stats }) => {
                    log.silly("change", `Removing ${item}...`);

                    marky.mark("delete");

                    await del(path.join(dest, transform(item)));

                    log.silly("change", `Deleted in ${stop("delete")}`);
                });
                
                // Boot up the watcher
                await watcher.init();

                booting = false;

                log.silly("watch", `Initialized watcher in ${stop("watcher init")}`);
            }());

            log.silly("meta", `Setup complete in ${stop("setup")}`);
        },
    };
};
