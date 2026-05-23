Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = c(require("./3.js"));
var i = c(require("./6.js"));
var o = c(require("./4.js"));
var a = c(require("./0.js"));
var s = c(require("./1.js"));
var l = c(require("./5.js"));
var u = c(require("./2.js"));
function c(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var d = exports.styles = function (e) {
  return {
    root: {
      color: "inherit",
      display: "table-row",
      height: 48,
      "&:focus": {
        outline: "none"
      },
      verticalAlign: "middle"
    },
    typeHead: {
      height: 56
    },
    typeFooter: {
      height: 56
    },
    selected: {
      backgroundColor: e.palette.type === "light" ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.08)"
    },
    hover: {
      "&:hover": {
        backgroundColor: e.palette.type === "light" ? "rgba(0, 0, 0, 0.07)" : "rgba(255, 255, 255, 0.14)"
      }
    }
  };
};
function f(e, t) {
  var n;
  var s = e.classes;
  var u = e.className;
  var c = e.component;
  var d = e.hover;
  var f = e.selected;
  var p = (0, o.default)(e, ["classes", "className", "component", "hover", "selected"]);
  var h = t.table;
  var m = (0, l.default)(s.root, (n = {}, (0, i.default)(n, s.typeHead, h && h.head), (0, i.default)(n, s.typeFooter, h && h.footer), (0, i.default)(n, s.hover, h && d), (0, i.default)(n, s.selected, h && f), n), u);
  return a.default.createElement(c, (0, r.default)({
    className: m
  }, p));
}
f.propTypes = {};
f.defaultProps = {
  component: "tr",
  hover: false,
  selected: false
};
f.contextTypes = {
  table: s.default.object
};
exports.default = (0, u.default)(d, {
  name: "MuiTableRow"
})(f);