var r = require("./54.js").f;
var i = Function.prototype;
var o = /^\s*function ([^ (]*)/;
if (!("name" in i)) {
  if (require("./52.js")) {
    r(i, "name", {
      configurable: true,
      get: function () {
        try {
          return ("" + this).match(o)[1];
        } catch (e) {
          return "";
        }
      }
    });
  }
}