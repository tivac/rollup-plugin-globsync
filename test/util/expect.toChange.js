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

        // Fail if we don't see a change within a reasonable amount of time
        const timer = setTimeout(async () => {
            throw new Error(`File didn't change within timeout`);
        }, 4500);

        const result = await new Promise((resolve) => {
            watcher.on("change", async () => {
                const updated = await fs.readFile(file, "utf8");

                // Not the change we were looking for :(
                if(updated === initial) {
                    return;
                }

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

        clearTimeout(timer);

        await watcher.close();

        return result;
    },
});
