"use strict";

const path = require("path");
const fs = require("fs").promises;

const chokidar = require("chokidar");

const REMOVAL = new Set([ "unlink", "unlinkDir" ]);
const ADDITION = new Set([ "add", "addDir", "change" ]);

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

        const watcher = chokidar.watch(path.dirname(file), {
            disableGlobbing : true,
        });

        // Fail if we don't see a change within a reasonable amount of time
        const timer = setTimeout(async () => {
            throw new Error(`${file} timed out, should ${this.isNot ? "not exist" : "exist"}`);
        }, 4500);

        // Fail if the watcher throws a wobbly
        watcher.on("error", async (e) => {
            throw e;
        });

        const result = await new Promise((resolve) => {
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
