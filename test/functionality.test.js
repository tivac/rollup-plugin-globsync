"use strict";

const { rollup } = require("rollup");
const cp = require("cp-file");
const del = require("del");

const { specimen, temp } = require("./util/dirs.js");

require("./util/expect.toMatchDirSnapshot.js");

const plugin = require("../index.js");

describe("functionality", () => {
    const cwd = process.cwd();

    afterEach(() => {
        process.chdir(cwd);
    });

    it.only("should copy files when the build starts", async () => {
        const spec = specimen("basic");

        const dir = temp();

        process.chdir(dir());

        // Setup files in src temp dir
        await cp(spec("index.js"), dir("index.js"));
        await cp(spec("file.txt"), dir("file.txt"));

        const bundle = await rollup({
            input : dir("index.js"),

            plugins : [
                plugin({
                    patterns : [
                        "*.txt",
                    ],
                    dest    : dir("/dest"),
                    options : {
                        loglevel : "silly",
                    },
                }),
            ],
        });

        await bundle.generate({
            format : "esm",
        });

        expect(dir("/dest")).toMatchDirSnapshot();
    });

    it("should recopy changed files", async () => {
        const spec = specimen("basic");

        const dir = temp();

        process.chdir(dir());

        // Setup files in src temp dir
        await cp(spec("index.js"), dir("/src/index.js"));
        await cp(spec("file.txt"), dir("/src/file.txt"));

        await rollup({
            input : dir("/src/index.js"),

            plugins : [
                plugin({
                    patterns : [
                        "*.txt",
                    ],
                    dest    : dir("/dest"),
                    options : {
                        loglevel : "silly",
                    },
                    watching : true,
                }),
            ],
        });

        expect(dir("/dest")).toMatchDirSnapshot();

        // Change file.txt so the plugin sees it
        await cp(spec("index.js"), dir("/src/file.txt"));

        expect(dir("/dest")).toMatchDirSnapshot();
    });
    
    it("should remove deleted files", async () => {
        const spec = specimen("basic");

        const dir = temp();

        process.chdir(dir());

        // Setup files in src temp dir
        await cp(spec("index.js"), dir("/src/index.js"));
        await cp(spec("file.txt"), dir("/src/file.txt"));

        await rollup({
            input : dir("/src/index.js"),

            plugins : [
                plugin({
                    patterns : [
                        "*.txt",
                    ],
                    dest    : dir("/dest"),
                    options : {
                        loglevel : "silly",
                    },
                    watching : true,
                }),
            ],
        });

        expect(dir("/dest")).toMatchDirSnapshot();

        // Remove file.txt so the plugin sees it
        await del(dir("/src/file.txt"));

        expect(dir("/dest")).toMatchDirSnapshot();
    });
});
