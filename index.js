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
        marky.mark("copy");

        const out = transformed(item);
        const tgt = path.join(dest, out);

        files.set(item, out);

        log.silly("change", `${item} => ${out}`);

        // Delete the target before copying
        await del(tgt);

        await cp(path.join(dir, item), tgt);

        log.verbose("change", `Copied ${item} to ${out} in ${stop("copy")}`);
    };

    const remove = async (item) => {
        marky.mark("delete");
        
        log.silly("change", `Removing ${item}...`);

        const tgt = path.join(dest, transformed(item));

        await del(slash(tgt));

        files.delete(item);

        log.verbose("change", `Deleted ${tgt} in ${stop("delete")}`);
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

            const { readDirDeepSync : read } = require("read-dir-deep");

            console.log(read(dir));

            // Use globby to walk the FS and find all files matching globs
            // Used for initial copy of files
            const found = await globby(globs, { cwd : dir });

            // Generate a map of files to their transformed values
            files = new Map();
            found.forEach((file) => transformed(file));

            log.verbose("collect", `Collected ${files.size} files in ${stop("collecting")}`);

            // Don't want to make rollup wait on this, so wrapped in an async IIFE
            (async function() {
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
                return;
            }

            marky.mark("watcher setup");

            const watcher = chokidar.watch(globs, {
                ignoreInitial : true,
                cwd           : dir,
            });

            // Added or changed files/dirs
            watcher.on("add", copy);
            watcher.on("change", copy);

            // Removed files/dirs
            watcher.on("unlink", remove);
            watcher.on("unlinkDir", remove);

            watcher.once("ready", () => {
                log.verbose("watch", `Set up watcher in ${stop("watcher setup")}`);
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
    };
};
