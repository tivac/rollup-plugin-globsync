"use strict";

const path = require("path");

const tempy = require("tempy");
const cpy = require("cpy");

const specimens = path.resolve(__dirname, "../specimens");

exports.copy = (src, dest) => cpy(path.join(src, "/**"), dest);

exports.specimen = (specimen) => (...parts) => path.join(specimens, specimen, ...parts);

exports.temp = () => {
    const dir = tempy.directory();

    return (...parts) => path.join(dir, ...parts);
};
