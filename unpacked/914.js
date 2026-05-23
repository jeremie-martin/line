Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = d(require("./4.js"));
var i = d(require("./3.js"));
var o = d(require("./6.js"));
var a = d(require("./0.js"));
d(require("./1.js"));
var s = d(require("./5.js"));
var l = d(require("./2.js"));
var u = require("./122.js");
d(require("./915.js"));
var c = d(require("./251.js"));
function d(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var f = [0, 8, 16, 24, 40];
var p = [true, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
var h = exports.styles = function (e) {
  return (0, i.default)({
    typeContainer: {
      boxSizing: "border-box",
      display: "flex",
      flexWrap: "wrap",
      width: "100%"
    },
    typeItem: {
      boxSizing: "border-box",
      flex: "0 0 auto",
      margin: "0"
    },
    zeroMinWidth: {
      minWidth: 0
    },
    "direction-xs-column": {
      flexDirection: "column"
    },
    "direction-xs-column-reverse": {
      flexDirection: "column-reverse"
    },
    "direction-xs-row-reverse": {
      flexDirection: "row-reverse"
    },
    "wrap-xs-nowrap": {
      flexWrap: "nowrap"
    },
    "wrap-xs-wrap-reverse": {
      flexWrap: "wrap-reverse"
    },
    "align-items-xs-center": {
      alignItems: "center"
    },
    "align-items-xs-flex-start": {
      alignItems: "flex-start"
    },
    "align-items-xs-flex-end": {
      alignItems: "flex-end"
    },
    "align-items-xs-baseline": {
      alignItems: "baseline"
    },
    "align-content-xs-center": {
      alignContent: "center"
    },
    "align-content-xs-flex-start": {
      alignContent: "flex-start"
    },
    "align-content-xs-flex-end": {
      alignContent: "flex-end"
    },
    "align-content-xs-space-between": {
      alignContent: "space-between"
    },
    "align-content-xs-space-around": {
      alignContent: "space-around"
    },
    "justify-xs-center": {
      justifyContent: "center"
    },
    "justify-xs-flex-end": {
      justifyContent: "flex-end"
    },
    "justify-xs-space-between": {
      justifyContent: "space-between"
    },
    "justify-xs-space-around": {
      justifyContent: "space-around"
    }
  }, function (e, t) {
    var n = {};
    f.forEach(function (e, r) {
      if (r !== 0) {
        n["spacing-" + t + "-" + e] = {
          margin: -e / 2,
          width: "calc(100% + " + e + "px)",
          "& > $typeItem": {
            padding: e / 2
          }
        };
      }
    });
    return n;
  }(0, "xs"), u.keys.reduce(function (t, n) {
    (function (e, t, n) {
      var r = (0, o.default)({}, "grid-" + n, {
        flexBasis: 0,
        flexGrow: 1,
        maxWidth: "100%"
      });
      p.forEach(function (e) {
        if (typeof e != "boolean") {
          var t = Math.round(e / 12 * Math.pow(10, 6)) / Math.pow(10, 4) + "%";
          r["grid-" + n + "-" + e] = {
            flexBasis: t,
            maxWidth: t
          };
        }
      });
      if (n === "xs") {
        (0, i.default)(e, r);
      } else {
        e[t.breakpoints.up(n)] = r;
      }
    })(t, e, n);
    return t;
  }, {}));
};
function m(e) {
  var t;
  var n = e.alignContent;
  var l = e.alignItems;
  var u = e.classes;
  var d = e.className;
  var f = e.component;
  var p = e.container;
  var h = e.direction;
  var y = e.hidden;
  var g = e.item;
  var v = e.justify;
  var b = e.lg;
  var _ = e.md;
  var w = e.zeroMinWidth;
  var x = e.sm;
  var E = e.spacing;
  var S = e.wrap;
  var T = e.xl;
  var k = e.xs;
  var O = (0, r.default)(e, ["alignContent", "alignItems", "classes", "className", "component", "container", "direction", "hidden", "item", "justify", "lg", "md", "zeroMinWidth", "sm", "spacing", "wrap", "xl", "xs"]);
  var P = (0, s.default)((t = {}, (0, o.default)(t, u.typeContainer, p), (0, o.default)(t, u.typeItem, g), (0, o.default)(t, u.zeroMinWidth, w), (0, o.default)(t, u["spacing-xs-" + String(E)], p && E !== 0), (0, o.default)(t, u["direction-xs-" + String(h)], h !== m.defaultProps.direction), (0, o.default)(t, u["wrap-xs-" + String(S)], S !== m.defaultProps.wrap), (0, o.default)(t, u["align-items-xs-" + String(l)], l !== m.defaultProps.alignItems), (0, o.default)(t, u["align-content-xs-" + String(n)], n !== m.defaultProps.alignContent), (0, o.default)(t, u["justify-xs-" + String(v)], v !== m.defaultProps.justify), (0, o.default)(t, u["grid-xs"], k === true), (0, o.default)(t, u["grid-xs-" + String(k)], k && k !== true), (0, o.default)(t, u["grid-sm"], x === true), (0, o.default)(t, u["grid-sm-" + String(x)], x && x !== true), (0, o.default)(t, u["grid-md"], _ === true), (0, o.default)(t, u["grid-md-" + String(_)], _ && _ !== true), (0, o.default)(t, u["grid-lg"], b === true), (0, o.default)(t, u["grid-lg-" + String(b)], b && b !== true), (0, o.default)(t, u["grid-xl"], T === true), (0, o.default)(t, u["grid-xl-" + String(T)], T && T !== true), t), d);
  var C = (0, i.default)({
    className: P
  }, O);
  if (y) {
    return a.default.createElement(c.default, y, a.default.createElement(f, C));
  } else {
    return a.default.createElement(f, C);
  }
}
m.propTypes = {};
m.defaultProps = {
  alignContent: "stretch",
  alignItems: "stretch",
  component: "div",
  container: false,
  direction: "row",
  item: false,
  justify: "flex-start",
  zeroMinWidth: false,
  spacing: 16,
  wrap: "wrap"
};
var y = m;
exports.default = (0, l.default)(h, {
  name: "MuiGrid"
})(y);