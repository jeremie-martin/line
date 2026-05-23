Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./6.js"));
var i = o(require("./3.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = function (e, t, n) {
  var o;
  return (0, i.default)({
    gutters: function (n) {
      return (0, i.default)({
        paddingLeft: t.unit * 2,
        paddingRight: t.unit * 2
      }, n, (0, r.default)({}, e.up("sm"), (0, i.default)({
        paddingLeft: t.unit * 3,
        paddingRight: t.unit * 3
      }, n[e.up("sm")])));
    },
    toolbar: (o = {
      minHeight: 56
    }, (0, r.default)(o, e.up("xs") + " and (orientation: landscape)", {
      minHeight: 48
    }), (0, r.default)(o, e.up("sm"), {
      minHeight: 64
    }), o)
  }, n);
};