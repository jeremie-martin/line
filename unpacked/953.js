var t = require("./18.js");
var n;
n = typeof window != "undefined" ? window : t !== undefined ? t : typeof self != "undefined" ? self : {};
module.exports = n;