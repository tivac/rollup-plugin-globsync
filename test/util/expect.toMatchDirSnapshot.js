"use strict";

const fs = require("fs");
const path = require("path");

const { readDirDeepSync : read } = require("read-dir-deep");
const { toMatchSnapshot } = require("jest-snapshot");

expect.extend({
    toMatchDirSnapshot(source, testName = "") {
        const files = read(source, { absolute : true });

        const contents = files.sort().map((file) => ({
            file : path.relative(source, file),
            text : fs.readFileSync(file, "utf8"),
        }));

        return toMatchSnapshot.call(
            this,
            contents,
            testName,
        );
    },
});
