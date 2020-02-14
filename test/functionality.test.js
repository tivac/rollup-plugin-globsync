"use strict";

const fs = require("fs").promises;
const path = require("path");

const { rollup } = require("rollup");
const cp = require("cp-file");
const del = require("del");

const { specimen, temp, copy } = require("./util/dirs.js");

require("./util/expect.toMatchDirSnapshot.js");
require("./util/expect.toExist.js");
require("./util/expect.toChange.js");

const plugin = require("../index.js");

const transform = (file) => {
    const { dir : d, name, ext } = path.parse(file);

    return `${d}/${name}.transformed${ext}`;
};

describe("functionality", () => {
    jest.setTimeout(10000);

    const wait = 9500;

    const cwd = process.cwd();
    let dir;
    let instance;

    beforeEach(() => {
        dir = temp();
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

        const bundle = await rollup({
            input : spec("/index.js"),

            plugins : [
                plugin({
                    dir   : spec(),
                    dest  : dir("/dest"),
                    globs : [
                        "*.txt",
                    ],
                }),
            ],
        });

        await bundle.generate({
            format : "esm",
        });

        await expect(dir("/dest/file.txt")).toExist();
    });

    it("should recopy changed files", async () => {
        const spec = specimen("basic");

        await copy(spec(), dir());

        process.chdir(dir());

        instance = plugin({
            dest  : dir("/dest"),
            globs : [
                "*.txt",
            ],

            _watching : true,
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

        const changed = expect(dir("/dest/file.txt")).toChange({ wait });

        await cp(spec("index.js"), dir("/file.txt"));

        await changed;
    });

    it("should copy added files", async () => {
        const spec = specimen("basic");

        await copy(spec(), dir());

        process.chdir(dir());

        instance = plugin({
            dest  : dir("/dest"),
            globs : [
                "*.txt",
            ],

            _watching : true,
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

        process.chdir(dir());

        instance = plugin({
            dest  : dir("/dest"),
            globs : [
                "*.txt",
            ],

            _watching : true,
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

        const exists = expect(dir("/dest/file.transformed.txt")).toExist();

        await rollup({
            input : spec("/index.js"),

            plugins : [
                plugin({
                    dir   : spec(),
                    dest  : dir("/dest"),
                    globs : [
                        "*.txt",
                    ],
                    transform,
                }),
            ],
        });

        await exists;
    });

    it("should support not cleaning the destination directory", async () => {
        const spec = specimen("basic");

        await cp(spec("file.txt"), dir("/dest/already-there.txt"));

        const bundle = await rollup({
            input : spec("/index.js"),

            plugins : [
                plugin({
                    dir   : spec(),
                    dest  : dir("/dest"),
                    globs : [
                        "*.txt",
                    ],

                    clean : false,
                }),
            ],
        });

        // Wait until the initial copy is complete
        await bundle.generate({
            format : "esm",
        });

        await expect(dir("/dest/already-there.txt")).toExist();
    });

    it.each([
        [ "manifest", { manifest : "manifest" } ],
        [ "manifest/transform", { manifest : "manifest", transform, } ],
        [ "manifest.module", { manifest : { module : "manifest" } }],
        [ "manifest.module/transform", { manifest : { module : "manifest" }, transform, }],
    ])("should provide manifest as a module (%s)", async (key, config) => {
        const spec = specimen("manifest");

        const bundle = await rollup({
            input : spec("/index.js"),

            plugins : [
                plugin({
                    dir   : spec(),
                    dest  : dir("/dest"),
                    globs : [
                        "*.txt",
                    ],

                    ...config,
                }),
            ],
        });

        const { output } = await bundle.generate({
            format : "esm",
        });

        const [{ code }] = output;

        expect(code).toMatchSnapshot();
    });

    it.each([
        [ "file", {} ],
        [ "file w/ transforms", { transform }],
    ])("should provide manifest as a %s", async (key, config) => {
        const spec = specimen("basic");

        const bundle = await rollup({
            input : spec("/index.js"),

            plugins : [
                plugin({
                    dir   : spec(),
                    dest  : dir("/dest"),
                    globs : [
                        "*.txt",
                    ],

                    manifest : {
                        file : "manifest.json",
                    },

                    ...config,
                }),
            ],
        });

        // Manifest is written out when build finishes, so this has to happen
        await bundle.write({
            format : "esm",
            dir    : dir("/dest"),
        });

        await expect(dir("/dest/manifest.json")).toExist();

        await expect(fs.readFile(dir("/dest/manifest.json"), "utf8")).resolves.toMatchSnapshot();
    });
});
