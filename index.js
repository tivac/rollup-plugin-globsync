"use strict";

const path = require("path");

const match = require("multimatch");
const globby = require("globby");
const cp = require("cp-file");
const del = require("del");

const CheapWatch = require("cheap-watch");

const log = require("npmlog");

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

    log.silly("config", JSON.stringify(globs));

    return {
        name : "globsync",

        buildStart() {
            if(runs++) {
                return;
            }

            let booting = true;
            
            if(clean) {
                log.verbose("clean", `Cleaning ${dest}...`);

                del.sync(dest);
            }
            
            log.silly("collect", `Collecting files...`);

            // Use globby to walk the FS and find all files matching globs
            // for use in cheap-watch's filter function since it'll need to know
            // to iterate intermediate directories and glob matchers aren't good at that bit
            const files = globby.sync(globs, { cwd : dir });
            
            log.silly("collect", "Done collecting files");

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
            

            // Don't want to make rollup wait on this, so wrapped in an async IIFE
            (async function() {
                await watcher.init();

                booting = false;

                if(watch) {
                    log.info("watch", "Watching for changes to copy...");
                } else {
                    watcher.close();
                }
            }());
            
            log.silly("copy", "Initial copy starting...");

            // Don't want to make rollup wait on this, so wrapped in an async IIFE
            (async function() {
                await files.forEach((file) => cp(file, path.join(dest, transform(file))));

                log.silly("copy", "Initial copy complete");
            }());

            // Added or changed files/dirs
            watcher.on("+", ({ path : item, stats }) => {
                // Never want to copy just a directory, cp-file will create
                // intermediate directories automatically anyways
                if(stats.isDirectory()) {
                    return;
                }

                log.silly("change", `Copying ${item}...`);
                
                cp(path.join(dir, item), path.join(dest, transform(item)));
            });
            
            // Removed files/dirs
            watcher.on("-", ({ path : item, stats }) => {
                log.silly("change", `Removing ${item}...`);

                del(path.join(dest, transform(item)));
            });
        },
    };
};
