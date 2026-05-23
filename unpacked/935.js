Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = u(require("./3.js"));
var i = u(require("./4.js"));
var o = u(require("./0.js"));
u(require("./1.js"));
var a = u(require("./5.js"));
var s = u(require("./2.js"));
var l = u(require("./248.js"));
function u(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var c = exports.styles = function (e) {
  return {
    root: {
      display: "inline-flex",
      width: 62,
      position: "relative",
      flexShrink: 0,
      verticalAlign: "middle"
    },
    bar: {
      borderRadius: 7,
      display: "block",
      position: "absolute",
      width: 34,
      height: 14,
      top: "50%",
      marginTop: -7,
      left: "50%",
      marginLeft: -17,
      transition: e.transitions.create(["opacity", "background-color"], {
        duration: e.transitions.duration.shortest
      }),
      backgroundColor: e.palette.type === "light" ? e.palette.common.black : e.palette.common.white,
      opacity: e.palette.type === "light" ? 0.38 : 0.3
    },
    icon: {
      boxShadow: e.shadows[1],
      backgroundColor: "currentColor",
      width: 20,
      height: 20,
      borderRadius: "50%"
    },
    default: {
      zIndex: 1,
      color: e.palette.type === "light" ? e.palette.grey[50] : e.palette.grey[400],
      transition: e.transitions.create("transform", {
        duration: e.transitions.duration.shortest
      })
    },
    checked: {
      color: e.palette.primary.main,
      transform: "translateX(14px)",
      "& + $bar": {
        backgroundColor: e.palette.primary.main,
        opacity: 0.5
      }
    },
    disabled: {
      color: e.palette.type === "light" ? e.palette.grey[400] : e.palette.grey[800],
      "& + $bar": {
        backgroundColor: e.palette.type === "light" ? e.palette.common.black : e.palette.common.white,
        opacity: e.palette.type === "light" ? 0.12 : 0.1
      }
    }
  };
};
function d(e) {
  var t = e.classes;
  var n = e.className;
  var s = (0, i.default)(e, ["classes", "className"]);
  var u = o.default.createElement("span", {
    className: t.icon
  });
  return o.default.createElement("span", {
    className: (0, a.default)(t.root, n)
  }, o.default.createElement(l.default, (0, r.default)({
    icon: u,
    classes: {
      default: t.default,
      checked: t.checked,
      disabled: t.disabled
    },
    checkedIcon: u
  }, s)), o.default.createElement("span", {
    className: t.bar
  }));
}
d.propTypes = {};
exports.default = (0, s.default)(c, {
  name: "MuiSwitch"
})(d);