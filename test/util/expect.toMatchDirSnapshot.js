"use strict";

const fs = require("fs");
const path = require("path");

const { readDirDeepSync : read } = require("read-dir-deep");
const { toMatchSnapshot } = require("jest-snapshot");

expect.extend({
    toMatchDirSnapshot(source) {
        const files = read(source);

        const contents = files.sort().map((file) => ({
            file,
            text : fs.readFileSync(path.join(source, file), "utf8"),
        }));

        return toMatchSnapshot.call(
            this,
            contents
        );
    },
});
