"use strict";

const path = require("path");

const chokidar = require("chokidar");
const cp = require("cp-file");
const del = require("del");
const globby = require("globby");

const log = require("npmlog");
const marky = require("marky");
const pretty = require("pretty-ms");

// Wrapper around pretty-ms and marky.stop
const stop = (name) => pretty(marky.stop(name).duration);

const slash = (str) => str.replace(/\\/g, "/");

module.exports = ({ patterns = [], dest = "./dist", options = false }) => {
    const {
        dir = process.cwd(),
        clean = true,
        verbose = false,
        manifest = false,
        loglevel = "info",
        transform = false,
        watching = false,
    } = options;

    const {
        module : assetsmodule = manifest,
        file : assetsfile = false,
    } = manifest;

    log.level = verbose ? "verbose" : loglevel;

    const watch = watching || Boolean(process.env.ROLLUP_WATCH);

    let runs = 0;
    let files;
    let watcher;
    let initialCopy;
    let watcherReady;

    marky.mark("generating globs");

    const globs = [
        // The worst dir for a watcher to walk, yikes
        "!**/node_modules/**",

        ...patterns
            // Filter out falsey values
            .filter(Boolean)
            // flatten one level deep
            .reduce((acc, val) => acc.concat(val), [])
            // make absolute paths relative so they match anything
            .map((item) => (
                path.isAbsolute(item) ?
                    `./${slash(path.relative(dir, item))}` :
                    item
            )),

        // No inception, please
        `!./${slash(path.relative(dir, dest))}/**`,
    ];

    const transformed = (file) => {
        if(files.has(file)) {
            return files.get(file);
        }

        let out = path.join(dest, file);

        if(transform) {
            out = transform(out);
        }

        files.set(file, out);

        return out;
    };

    const copy = async (item) => {
        const timer = `copy-${item}`;

        marky.mark(timer);

        const tgt = transformed(item);

        log.silly("copy", `Copying ${item}...`);

        // Delete the target before copying
        await del(tgt);

        await cp(path.join(dir, item), tgt);

        log.verbose("copy", `Copied ${tgt} in ${stop(timer)}`);
    };

    const remove = async (item) => {
        const timer = `delete-${item}`;

        marky.mark(timer);
        
        log.silly("remove", `Removing ${item}...`);

        const tgt = transformed(item);

        await del(slash(tgt));

        files.delete(item);

        log.verbose("remove", `Deleted ${tgt} in ${stop(timer)}`);
    };

    log.silly("config", `Globs:\n${JSON.stringify(globs, null, 4)}`);
    log.silly("config", `Generating globs took ${stop("generating globs")}`);
    log.silly("config", `Destination: ${dest}`);
    log.silly("config", `Options ${JSON.stringify({
        dir,
        clean,
        verbose,
        manifest,
        loglevel,
        transform,
        watching,
    }, null, 4)}`);

    return {
        name : "globsync",

        async buildStart() {
            // Only want to run this setup once at buildStart
            if(runs++) {
                return;
            }

            // Just in case!
            marky.clear();

            log.silly("collect", `Collecting files...`);

            marky.mark("collecting");

            // Use globby to walk the FS and find all files matching globs
            // Used for initial copy of files
            const found = await globby(globs, { cwd : dir });

            // Generate a map of files to their transformed values
            files = new Map();
            found.forEach((file) => transformed(file));

            log.verbose("collect", `Collected ${files.size} files in ${stop("collecting")}`);

            // Don't want to make rollup wait on this before bundling, so wrapped in an async IIFE
            // and checked down below in generateBundle
            initialCopy = (async function() {
                if(clean) {
                    marky.mark("cleaning");

                    await del(slash(dest));

                    log.verbose("clean", `Cleaning destination took ${stop("cleaning")}`);
                }

                log.silly("copy", "Initial copy starting...");

                marky.mark("copying");

                await Promise.all(
                    [ ...files.entries() ].map(([ input, output ]) => {
                        const src = path.join(dir, input);

                        log.silly("copy", `${src} => ${output}`);

                        return cp(src, output);
                    })
                );

                log.verbose("copy", `Initial copy complete in ${stop("copying")}`);
            }());

            if(!watch) {
                watcherReady = Promise.resolve();

                return;
            }

            log.silly("watch", "Setting up watcher...");

            marky.mark("watcher setup");

            watcher = chokidar.watch(globs, {
                ignoreInitial : true,
                cwd           : dir,
            });

            // Added or changed files/dirs
            watcher.on("add", copy);
            watcher.on("change", copy);

            // Removed files/dirs
            watcher.on("unlink", remove);
            watcher.on("unlinkDir", remove);

            // Oh noooooo something bad happened
            watcher.on("error", (e) => {
                throw e;
            });

            watcherReady = new Promise((resolve) => {
                watcher.once("ready", () => {
                    const watched = watcher.getWatched();
                    const paths = [];

                    Object.keys(watched).forEach((key) => {
                        watched[key].forEach((file) => {
                            paths.push(`${key}/${file}`);
                        });
                    });
    
                    log.verbose("watch", `Watching ${paths.length} paths`);
                    log.silly("watch", JSON.stringify(paths, null, 4));
                    log.verbose("watch", `Set up watcher in ${stop("watcher setup")}`);

                    resolve();
                });
            });
        },

        resolveId(importee) {
            return importee === assetsmodule ? assetsmodule : undefined;
        },

        load(id) {
            if(id !== assetsmodule) {
                return null;
            }

            return `export default new Map(${JSON.stringify([ ...files.entries() ])})`;
        },

        async generateBundle() {
            await Promise.all([
                initialCopy,
                watcherReady,
            ]);
        },

        buildEnd(error) {
            if(error || !assetsfile) {
                return;
            }

            const output = { __proto__ : null };
            
            files.forEach((out, src) => {
                output[src] = out;
            });

            this.emitFile({
                type     : "asset",
                source   : JSON.stringify(output, null, 4),
                fileName : assetsfile,
            });
        },

        // Only really intended to be used by tests
        async _stop() {
            await watcher.close();

            watcher = false;
        },
    };
};
