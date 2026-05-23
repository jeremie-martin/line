Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = f(require("./3.js"));
var i = f(require("./6.js"));
var o = f(require("./4.js"));
var a = f(require("./0.js"));
var s = f(require("./1.js"));
var l = f(require("./5.js"));
var u = f(require("./2.js"));
var c = require("./20.js");
var d = require("./73.js");
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var p = exports.styles = function (e) {
  return {
    root: {
      borderBottom: "1px solid\n    " + (e.palette.type === "light" ? (0, d.lighten)((0, d.fade)(e.palette.divider, 1), 0.88) : (0, d.darken)((0, d.fade)(e.palette.divider, 1), 0.8)),
      textAlign: "left"
    },
    numeric: {
      textAlign: "right",
      flexDirection: "row-reverse"
    },
    typeHead: {
      color: e.palette.text.secondary,
      fontSize: e.typography.pxToRem(12),
      fontWeight: e.typography.fontWeightMedium,
      position: "relative"
    },
    typeBody: {
      fontSize: e.typography.pxToRem(13),
      color: e.palette.text.primary
    },
    typeFooter: {
      borderBottom: 0,
      color: e.palette.text.secondary,
      fontSize: e.typography.pxToRem(12)
    },
    paddingDefault: {
      padding: e.spacing.unit / 2 + "px " + e.spacing.unit * 7 + "px " + e.spacing.unit / 2 + "px " + e.spacing.unit * 3 + "px",
      "&:last-child": {
        paddingRight: e.spacing.unit * 3
      }
    },
    paddingDense: {
      paddingRight: e.spacing.unit * 3
    },
    paddingCheckbox: {
      padding: "0 12px"
    }
  };
};
function h(e, t) {
  var n;
  var s = e.children;
  var u = e.classes;
  var d = e.className;
  var f = e.component;
  var p = e.sortDirection;
  var h = e.numeric;
  var m = e.padding;
  var y = e.type;
  var g = (0, o.default)(e, ["children", "classes", "className", "component", "sortDirection", "numeric", "padding", "type"]);
  var v = t.table;
  var b = undefined;
  b = f || (v && v.head ? "th" : "td");
  var _ = (0, l.default)(u.root, (n = {}, (0, i.default)(n, u.numeric, h), (0, i.default)(n, u["padding" + (0, c.capitalize)(m)], m !== "none" && m !== "default"), (0, i.default)(n, u.paddingDefault, m !== "none"), (0, i.default)(n, u.typeHead, y ? y === "head" : v && v.head), (0, i.default)(n, u.typeBody, y ? y === "body" : v && v.body), (0, i.default)(n, u.typeFooter, y ? y === "footer" : v && v.footer), n), d);
  var w = null;
  if (p) {
    w = p === "asc" ? "ascending" : "descending";
  }
  return a.default.createElement(b, (0, r.default)({
    className: _,
    "aria-sort": w
  }, g), s);
}
h.propTypes = {};
h.defaultProps = {
  numeric: false,
  padding: "default"
};
h.contextTypes = {
  table: s.default.object.isRequired
};
exports.default = (0, u.default)(p, {
  name: "MuiTableCell"
})(h);