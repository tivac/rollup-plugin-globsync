"use strict";

const path = require("path");

const chokidar = require("chokidar");
const cp = require("cp-file");
const del = require("del");

const log = require("npmlog");
const marky = require("marky");
const pretty = require("pretty-ms");

// Wrapper around pretty-ms and marky.stop
const stop = (name) => pretty(marky.stop(name).duration);

const slash = (str) => str.replace(/\\/g, "/");

module.exports = (options = false) => {
    const {
        globs,
        clean = true,
        dest = "./dist",
        dir = process.cwd(),
        loglevel = "info",
        manifest = false,
        transform = false,
        verbose = false,
    } = options;

    if(!globs) {
        throw new Error("Must provide { globs : [] } to rollup-plugin-globsync");
    }

    const {
        module : assetsmodule = manifest,
        file : assetsfile = false,
    } = manifest;

    log.level = verbose ? "verbose" : loglevel;

    let runs = 0;
    let files;
    let watcher;
    let watcherReady;

    marky.mark("generating globs");

    const patterns = [
        // The worst dir for a watcher to walk, yikes
        "!**/node_modules/**",

        ...globs
            // Filter out falsey values
            .filter(Boolean)
            // flatten one level deep
            .reduce((acc, val) => acc.concat(val), [])
            // No \ allowed
            .map((glob) => slash(glob)),

        // No inception, please
        `!${slash(dest)}/**`,
    ];

    const transformed = (file) => {
        if(files.has(file)) {
            return files.get(file);
        }

        const out = transform ? transform(file) : file;

        files.set(file, out);

        return out;
    };

    const copy = async (item) => {
        const timer = `copy-${item}`;

        marky.mark(timer);

        const tgt = path.join(dest, transformed(item));

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

        const tgt = path.join(dest, transformed(item));

        await del(slash(tgt));

        files.delete(item);

        log.verbose("remove", `Deleted ${tgt} in ${stop(timer)}`);
    };

    log.silly("config", `Globs:\n${JSON.stringify(patterns, null, 4)}`);
    log.silly("config", `Generating globs took ${stop("generating globs")}`);
    log.silly("config", `Destination: ${dest}`);
    log.silly("config", `Options ${JSON.stringify({
        dir,
        clean,
        verbose,
        manifest,
        loglevel,
        transform,
    }, null, 4)}`);

    return {
        name : "globsync",

        async buildStart() {
            // Only want to run this setup once at buildStart
            /* istanbul ignore next */
            if(runs++) {
                return;
            }

            files = new Map();

            if(clean) {
                marky.mark("cleaning");

                await del(slash(dest));

                log.verbose("clean", `Cleaning destination took ${stop("cleaning")}`);
            }

            log.silly("watch", "Setting up watcher...");

            marky.mark("watcher setup");

            watcher = chokidar.watch(patterns, {
                cwd : dir,
            });

            // Added or changed files/dirs
            watcher.on("add", copy);
            watcher.on("change", copy);

            // Removed files/dirs
            watcher.on("unlink", remove);
            watcher.on("unlinkDir", remove);

            // Oh noooooo something bad happened
            /* istanbul ignore next */
            watcher.on("error", (e) => {
                throw e;
            });

            watcherReady = new Promise((resolve) => {
                watcher.on("ready", () => {
                    const watched = watcher.getWatched();
                    const paths = [];

                    Object.keys(watched).forEach((key) => {
                        watched[key].forEach((file) => {
                            paths.push(`${key}/${file}`);
                        });
                    });

                    log.verbose("copy", `Copied ${files.size} files`);
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

        async load(id) {
            if(id !== assetsmodule) {
                return null;
            }

            await watcherReady;

            return `export default new Map(${JSON.stringify([ ...files.entries() ])})`;
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

        async generateBundle() {
            await watcherReady;
        },

        // Only really intended to be used by tests
        async _stop() {
            await watcher.close();

            watcher = false;
        },
    };
};
