var r = require("./134.js");
var i = require("./446.js");
r(r.G + r.B, {
  setImmediate: i.set,
  clearImmediate: i.clear
});