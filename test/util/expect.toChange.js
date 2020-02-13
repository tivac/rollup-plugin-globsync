"use strict";

const fs = require("fs").promises;

const chokidar = require("chokidar");

const { toMatchSnapshot } = require("jest-snapshot");
const diff = require("snapshot-diff");

expect.extend({
    async toChange(file, testName = "") {
        const initial = await fs.readFile(file, "utf8");

        const watcher = chokidar.watch(file, {
            ignoreInitial   : true,
            disableGlobbing : true,
        });

        return new Promise((resolve) => {
            // Fail if we don't see a change within a reasonable amount of time
            const timer = setTimeout(async () => {
                await watcher.close();

                throw new Error(`File didn't change within timeout`);
            }, 4500);

            watcher.on("change", async () => {
                clearTimeout(timer);

                await watcher.close();

                const updated = await fs.readFile(file, "utf8");

                const difference = diff(
                    initial.trim(),
                    updated.trim(),
                    {
                        stablePatchmarks : true,
                    },
                );

                resolve(toMatchSnapshot.call(this, difference, testName));
            });
        });
    },
});
