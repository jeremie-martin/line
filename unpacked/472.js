var r = require("./473.js");
if (typeof r == "string") {
  r = [[module.i, r, ""]];
}
var i = {
  hmr: true,
  transform: undefined,
  insertInto: undefined
};
require("./273.js")(r, i);
if (r.locals) {
  module.exports = r.locals;
}