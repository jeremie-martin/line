Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = u(require("./3.js"));
var i = u(require("./6.js"));
var o = u(require("./4.js"));
var a = u(require("./0.js"));
u(require("./1.js"));
var s = u(require("./5.js"));
var l = u(require("./2.js"));
function u(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var c = exports.styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    flexWrap: "wrap"
  },
  row: {
    flexDirection: "row"
  }
};
function d(e) {
  var t = e.classes;
  var n = e.className;
  var l = e.children;
  var u = e.row;
  var c = (0, o.default)(e, ["classes", "className", "children", "row"]);
  var d = (0, s.default)(t.root, (0, i.default)({}, t.row, u), n);
  return a.default.createElement("div", (0, r.default)({
    className: d
  }, c), l);
}
d.propTypes = {};
d.defaultProps = {
  row: false
};
exports.default = (0, l.default)(c, {
  name: "MuiFormGroup"
})(d);