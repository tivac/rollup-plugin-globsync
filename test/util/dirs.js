"use strict";

const path = require("path");

const tempy = require("tempy");

const specimens = path.resolve(__dirname, "../specimens");

exports.specimen = (specimen) => (...parts) => path.join(specimens, specimen, ...parts);

exports.temp = () => {
    const dir = tempy.directory();

    return (...parts) => path.join(dir, ...parts);
};
