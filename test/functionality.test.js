"use strict";

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

    beforeEach(() => {
        dir = temp();

        process.chdir(dir());
    });

    afterEach(() => {
        process.chdir(cwd);
    });

    it("should copy files when the build starts", async () => {
        const spec = specimen("basic");

        // Setup files in src temp dir
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

        // Setup files in src temp dir
        await copy(spec(), dir());

        const instance = plugin({
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

        // Make sure the initial version is there
        await bundle.generate({
            format : "esm",
        });

        const changed = expect(dir("/dest/file.txt")).toChange();

        // Change file.txt so the plugin sees it
        await cp(spec("index.js"), dir("/file.txt"));

        await changed;

        await instance._stop();
    });
    
    it("should copy added files", async () => {
        const spec = specimen("basic");

        // Setup files in src temp dir
        await copy(spec(), dir());

        const instance = plugin({
            dest     : dir("/dest"),
            patterns : [
                "*.txt",
            ],
            options : {
                watching : true,
                loglevel : "silly",
            },
        });

        const bundle = await rollup({
            input : dir("/index.js"),

            plugins : [
                instance,
            ],
        });

        // Make sure the initial version is there
        await bundle.generate({
            format : "esm",
        });

        // Add a new file
        await cp(spec("file.txt"), dir("/file2.txt"));

        await expect(dir("/dest/file2.txt")).toExist();

        await instance._stop();
    });
    
    it("should remove deleted files", async () => {
        const spec = specimen("basic");

        // Setup files in src temp dir
        await copy(spec(), dir());

        const instance = plugin({
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
        
        expect(dir("/dest")).toMatchDirSnapshot();
        
        // Remove file.txt so the plugin sees it
        await del(dir("/file.txt"));
        
        await expect(dir("/dest/file.txt")).not.toExist();

        await instance._stop();
    });
});
