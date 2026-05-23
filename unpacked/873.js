Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = d(require("./3.js"));
var i = d(require("./6.js"));
var o = d(require("./4.js"));
var a = d(require("./0.js"));
var s = d(require("./1.js"));
var l = d(require("./5.js"));
var u = d(require("./2.js"));
var c = d(require("./19.js"));
function d(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var f = exports.styles = function (e) {
  return {
    root: {
      flex: "1 1 auto",
      minWidth: 0,
      padding: "0 16px",
      "&:first-child": {
        paddingLeft: 0
      }
    },
    inset: {
      "&:first-child": {
        paddingLeft: e.spacing.unit * 7
      }
    },
    dense: {
      fontSize: e.typography.pxToRem(13)
    },
    primary: {
      "&$textDense": {
        fontSize: "inherit"
      }
    },
    secondary: {
      "&$textDense": {
        fontSize: "inherit"
      }
    },
    textDense: {}
  };
};
function p(e, t) {
  var n;
  var s = e.classes;
  var u = e.className;
  var d = e.disableTypography;
  var f = e.inset;
  var p = e.primary;
  var h = e.secondary;
  var m = (0, o.default)(e, ["classes", "className", "disableTypography", "inset", "primary", "secondary"]);
  var y = t.dense;
  var g = (0, l.default)(s.root, (n = {}, (0, i.default)(n, s.dense, y), (0, i.default)(n, s.inset, f), n), u);
  return a.default.createElement("div", (0, r.default)({
    className: g
  }, m), p && (d ? p : a.default.createElement(c.default, {
    type: "subheading",
    className: (0, l.default)(s.primary, (0, i.default)({}, s.textDense, y))
  }, p)), h && (d ? h : a.default.createElement(c.default, {
    type: "body1",
    className: (0, l.default)(s.secondary, (0, i.default)({}, s.textDense, y)),
    color: "textSecondary"
  }, h)));
}
p.propTypes = {};
p.defaultProps = {
  disableTypography: false,
  inset: false,
  primary: false,
  secondary: false
};
p.contextTypes = {
  dense: s.default.bool
};
exports.default = (0, u.default)(f, {
  name: "MuiListItemText"
})(p);