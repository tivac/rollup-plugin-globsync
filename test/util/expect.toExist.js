"use strict";

const path = require("path");
const fs = require("fs").promises;

const chokidar = require("chokidar");

const REMOVAL = new Set([ "unlink", "unlinkDir" ]);
const ADDITION = new Set([ "add", "addDir", "change" ]);


expect.extend({
    async toExist(file, options = false) {
        const name = path.basename(file);

        const {
            wait = 2000,
        } = options;

        const ok = () => `${name} exists`;
        const no = () => `${name} does not exist`;

        const check = async () => {
            try {
                await fs.access(file);

                if(!this.isNot) {
                    return {
                        pass    : true,
                        message : ok,
                    };
                }
            } catch(e) {
                if(this.isNot) {
                    return {
                        pass    : false,
                        message : no,
                    };
                }
            }

            return false;
        };

        const found = await check();

        if(found) {
            return found;
        }

        const watcher = chokidar.watch(path.dirname(file), {
            disableGlobbing : true,
        });

        // Fail if the watcher throws a wobbly
        watcher.on("error", async (e) => {
            await watcher.close();

            throw e;
        });

        let timer;

        const result = await new Promise((resolve) => {
            // Cap how long we'll wait
            timer = setTimeout(async () => {
                await watcher.close();

                // one last attempt to check
                const lastly = await check();

                if(lastly) {
                    return resolve(lastly);
                }

                throw new Error(`Waiting for existence timed out, ${file} ${this.isNot ? "still exists" : "doesn't exist"}`);
            }, wait);

            watcher.on("all", (event, item) => {
                // Only for the file we're looking at, and only the right type of event
                if(item !== file || !(this.isNot ? REMOVAL : ADDITION).has(event)) {
                    return;
                }

                resolve({
                    pass    : !this.isNot,
                    message : this.isNot ? no : ok,
                });
            });
        });

        clearTimeout(timer);
        await watcher.close();

        return result;
    },
});
