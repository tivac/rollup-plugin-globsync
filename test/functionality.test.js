"use strict";

const path = require("path");

const { rollup } = require("rollup");
const cp = require("cp-file");
const del = require("del");

const { specimen, temp, copy } = require("./util/dirs.js");

require("./util/expect.toMatchDirSnapshot.js");
require("./util/expect.toExist.js");
require("./util/expect.toChange.js");

const plugin = require("../index.js");

describe("functionality", () => {
    const cwd = process.cwd();
    let dir;
    let instance;

    beforeEach(() => {
        dir = temp();

        process.chdir(dir());
    });

    afterEach(() => {
        process.chdir(cwd);

        if(instance) {
            instance._stop();
        }

        instance = false;
        dir = false;
    });

    it("should copy files when the build starts", async () => {
        const spec = specimen("basic");

        await copy(spec(), dir());

        await rollup({
            input : dir("index.js"),

            plugins : [
                plugin({
                    dest     : dir("/dest"),
                    patterns : [
                        "*.txt",
                    ],
                }),
            ],
        });

        await expect(dir("/dest/file.txt")).toExist();
    });

    it("should recopy changed files", async () => {
        const spec = specimen("basic");

        await copy(spec(), dir());

        instance = plugin({
            dest     : dir("/dest"),
            patterns : [
                "*.txt",
            ],
            options : {
                watching : true,
            },
        });

        const bundle = await rollup({
            input : dir("/index.js"),

            plugins : [
                instance,
            ],
        });

        await bundle.generate({
            format : "esm",
        });

        await expect(dir("/dest/file.txt")).toExist();

        const changed = expect(dir("/dest/file.txt")).toChange();

        await cp(spec("index.js"), dir("/file.txt"));

        await changed;
    });
    
    it("should copy added files", async () => {
        const spec = specimen("basic");

        await copy(spec(), dir());

        instance = plugin({
            dest     : dir("/dest"),
            patterns : [
                "*.txt",
            ],
            options : {
                watching : true,
            },
        });

        await rollup({
            input : dir("/index.js"),

            plugins : [
                instance,
            ],
        });

        await cp(spec("file.txt"), dir("/file2.txt"));

        await expect(dir("/dest/file2.txt")).toExist();
    });
    
    it("should remove deleted files", async () => {
        const spec = specimen("basic");

        await copy(spec(), dir());

        instance = plugin({
            dest     : dir("/dest"),
            patterns : [
                "*.txt",
            ],

            options : {
                watching : true,
            },
        });

        const bundle = await rollup({
            input : dir("/index.js"),

            plugins : [
                instance,
            ],
        });

        await bundle.generate({
            format : "esm",
        });

        await expect(dir("/dest/file.txt")).toExist();
        
        await del(dir("/file.txt"));
        
        await expect(dir("/dest/file.txt")).not.toExist();
    });
        
    it("should use the transform function", async () => {
        const spec = specimen("basic");

        await copy(spec(), dir());

        await rollup({
            input : dir("/index.js"),

            plugins : [
                plugin({
                    dest     : dir("/dest"),
                    patterns : [
                        "*.txt",
                    ],
        
                    options : {
                        transform(file) {
                            const { dir : d, name, ext } = path.parse(file);
        
                            return `${d}/${name}.transformed${ext}`;
                        },
                    },
                }),
            ],
        });

        await expect(dir("/dest/file.transformed.txt")).toExist();
    });
});
