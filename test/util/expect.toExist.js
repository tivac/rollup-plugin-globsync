"use strict";

const path = require("path");
const fs = require("fs").promises;

const chokidar = require("chokidar");

expect.extend({
    async toExist(file) {
        const name = path.basename(file);

        const ok = () => `${name} exists`;
        const no = () => `${name} does not exist`;

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

        // First check didn't work, so now set up chokidar to watch for the change we want
        return new Promise((resolve) => {
            const watcher = chokidar.watch(path.dirname(file), {
                disableGlobbing : true,
            });

            watcher.on("error", async (e) => {
                // eslint-disable-next-line no-use-before-define
                clearTimeout(timer);
                
                await watcher.close();
                
                throw e;
            });

            // Fail if we don't see a change within a reasonable amount of time
            const timer = setTimeout(async () => {
                clearTimeout(timer);
                
                await watcher.close();

                throw new Error(`${file} timed out, should ${this.isNot ? "not exist" : "exist"}`);
            }, 4500);

            watcher.on("all", async (event, item) => {
                console.log({ event, item });
                
                if(item !== file) {
                    return;
                }
                
                clearTimeout(timer);

                await watcher.close();

                resolve({
                    pass    : true,
                    message : this.isNot ? no : ok,
                });
            });
        });
    },
});
