Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = d(require("./3.js"));
var i = d(require("./6.js"));
var o = d(require("./4.js"));
var a = d(require("./0.js"));
d(require("./1.js"));
var s = d(require("./5.js"));
var l = d(require("./945.js"));
var u = d(require("./2.js"));
var c = d(require("./32.js"));
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
      cursor: "pointer",
      display: "inline-flex",
      justifyContent: "flex-start",
      flexDirection: "inherit",
      alignItems: "center",
      "&:hover": {
        color: e.palette.text.primary
      },
      "&:focus": {
        color: e.palette.text.primary
      }
    },
    active: {
      color: e.palette.text.primary,
      "& $icon": {
        opacity: 1
      }
    },
    icon: {
      height: 16,
      marginRight: 4,
      marginLeft: 4,
      opacity: 0,
      transition: e.transitions.create(["opacity", "transform"], {
        duration: e.transitions.duration.shorter
      }),
      userSelect: "none",
      width: 16
    },
    desc: {
      transform: "rotate(0deg)"
    },
    asc: {
      transform: "rotate(180deg)"
    }
  };
};
function p(e) {
  var t = e.active;
  var n = e.classes;
  var u = e.className;
  var d = e.children;
  var f = e.direction;
  var p = (0, o.default)(e, ["active", "classes", "className", "children", "direction"]);
  var h = (0, s.default)(n.root, (0, i.default)({}, n.active, t), u);
  var m = (0, s.default)(n.icon, (0, i.default)({}, n[f], !!f));
  return a.default.createElement(c.default, (0, r.default)({
    className: h,
    component: "span",
    disableRipple: true
  }, p), d, a.default.createElement(l.default, {
    className: m
  }));
}
p.propTypes = {};
p.defaultProps = {
  active: false,
  direction: "desc"
};
exports.default = (0, u.default)(f, {
  name: "MuiTableSortLabel"
})(p);