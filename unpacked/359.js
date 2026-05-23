Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = f(require("./3.js"));
var i = f(require("./4.js"));
var o = f(require("./6.js"));
var a = f(require("./0.js"));
f(require("./1.js"));
var s = f(require("./5.js"));
var l = f(require("./2.js"));
var u = f(require("./37.js"));
var c = f(require("./19.js"));
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
  var t;
  var n = e.palette.type === "light" ? 0.8 : 0.98;
  var r = (0, d.emphasize)(e.palette.background.default, n);
  return {
    root: (t = {
      pointerEvents: "initial",
      color: e.palette.getContrastText(r),
      backgroundColor: r,
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      padding: "6px " + e.spacing.unit * 3 + "px"
    }, (0, o.default)(t, e.breakpoints.up("md"), {
      minWidth: 288,
      maxWidth: 568,
      borderRadius: 2
    }), (0, o.default)(t, e.breakpoints.down("sm"), {
      flexGrow: 1
    }), t),
    message: {
      padding: e.spacing.unit + "px 0"
    },
    action: {
      display: "flex",
      alignItems: "center",
      marginLeft: "auto",
      paddingLeft: e.spacing.unit * 3,
      marginRight: -e.spacing.unit
    }
  };
};
function h(e) {
  var t = e.action;
  var n = e.classes;
  var o = e.className;
  var l = e.message;
  var d = (0, i.default)(e, ["action", "classes", "className", "message"]);
  return a.default.createElement(u.default, (0, r.default)({
    component: c.default,
    headlineMapping: {
      body1: "div"
    },
    role: "alertdialog",
    square: true,
    elevation: 6,
    className: (0, s.default)(n.root, o)
  }, d), a.default.createElement("div", {
    className: n.message
  }, l), t ? a.default.createElement("div", {
    className: n.action
  }, t) : null);
}
h.propTypes = {};
exports.default = (0, l.default)(p, {
  name: "MuiSnackbarContent"
})(h);