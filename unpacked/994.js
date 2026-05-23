Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function () {
  return {
    onProcessStyle: function (e, t) {
      if (e.composes) {
        (function e(t, n) {
          if (!n) {
            return true;
          }
          if (Array.isArray(n)) {
            for (var r = 0; r < n.length; r++) {
              var i = e(t, n[r]);
              if (!i) {
                return false;
              }
            }
            return true;
          }
          if (n.indexOf(" ") > -1) {
            return e(t, n.split(" "));
          }
          var a = t.options.parent;
          if (n[0] === "$") {
            var s = a.getRule(n.substr(1));
            if (s) {
              if (s === t) {
                (0, o.default)(false, "[JSS] Cyclic composition detected. \r\n%s", t);
                return false;
              } else {
                a.classes[t.key] += " " + a.classes[s.key];
                return true;
              }
            } else {
              (0, o.default)(false, "[JSS] Referenced rule is not defined. \r\n%s", t);
              return false;
            }
          }
          t.options.parent.classes[t.key] += " " + n;
          return true;
        })(t, e.composes);
        delete e.composes;
        return e;
      } else {
        return e;
      }
    }
  };
};
var r;
var i = require("./14.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};