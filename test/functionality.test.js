"use strict";

const { rollup } = require("rollup");
const cp = require("cp-file");

const { specimen, temp } = require("./util/dirs.js");

require("./util/expect.toMatchDirSnapshot.js");

const plugin = require("../index.js");

describe("functionality", () => {
    afterEach(() => {
        process.env.ROLLUP_WATCH = false;
    });

    it.skip("should copy files when the build starts", async () => {
        const src  = specimen("basic");
        const dest = temp();

        await rollup({
            input : src("index.js"),

            plugins : [
                plugin({
                    patterns : [
                        "*.txt",
                    ],
                    dest    : dest(),
                    options : {
                        dir : src(),
                    },
                }),
            ],
        });

        expect(dest()).toMatchDirSnapshot();
    });

    it.skip("should recopy changed files", async () => {
        const spec = specimen("basic");

        const src = temp();
        const dest = temp();

        // Pretend rollup is watching (using rollup.watch doesn't trigger it, itnerestingly)
        process.env.ROLLUP_WATCH = true;

        // Setup files in src temp dir
        await cp(spec("index.js"), src("index.js"));
        await cp(spec("file.txt"), src("file.txt"));

        await rollup({
            input : src("index.js"),

            plugins : [
                plugin({
                    patterns : [
                        "*.txt",
                    ],
                    dest    : dest(),
                    options : {
                        dir      : src(),
                        loglevel : "silly",
                    },
                }),
            ],
        });

        expect(dest()).toMatchDirSnapshot();

        // Change file.txt so the plugin sees it
        await cp(spec("index.js"), src("file.txt"));

        expect(dest()).toMatchDirSnapshot();
    });
});
