Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./14.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
var a = /;\n/;
exports.default = function (e) {
  var t = {};
  for (var n = e.split(a), r = 0; r < n.length; r++) {
    var i = (n[r] || "").trim();
    if (i) {
      var s = i.indexOf(":");
      if (s !== -1) {
        var l = i.substr(0, s).trim();
        var u = i.substr(s + 1).trim();
        t[l] = u;
      } else {
        (0, o.default)(false, "Malformed CSS string \"%s\"", i);
      }
    }
  }
  return t;
};