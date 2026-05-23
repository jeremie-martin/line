var r = require("./670.js");
var i = require("./336.js");
module.exports = require("./672.js")("Map", function (e) {
  return function () {
    return e(this, arguments.length > 0 ? arguments[0] : undefined);
  };
}, {
  get: function (e) {
    var t = r.getEntry(i(this, "Map"), e);
    return t && t.v;
  },
  set: function (e, t) {
    return r.def(i(this, "Map"), e === 0 ? 0 : e, t);
  }
}, r, true);