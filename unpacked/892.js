Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = h(require("./3.js"));
var i = h(require("./6.js"));
var o = h(require("./4.js"));
var a = h(require("./0.js"));
h(require("./1.js"));
var s = h(require("./5.js"));
var l = h(require("./2.js"));
var u = require("./20.js");
var c = h(require("./75.js"));
var d = h(require("./128.js"));
var f = require("./43.js");
var p = h(require("./37.js"));
function h(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var m = exports.styles = function (e) {
  return {
    root: {
      justifyContent: "center",
      alignItems: "center"
    },
    paper: {
      display: "flex",
      margin: e.spacing.unit * 4,
      flexDirection: "column",
      flex: "0 1 auto",
      position: "relative",
      maxHeight: "90vh",
      overflowY: "auto",
      "&:focus": {
        outline: "none"
      }
    },
    paperWidthXs: {
      maxWidth: Math.max(e.breakpoints.values.xs, 360)
    },
    paperWidthSm: {
      maxWidth: e.breakpoints.values.sm
    },
    paperWidthMd: {
      maxWidth: e.breakpoints.values.md
    },
    fullWidth: {
      width: "100%"
    },
    fullScreen: {
      margin: 0,
      width: "100%",
      maxWidth: "100%",
      height: "100%",
      maxHeight: "100%",
      borderRadius: 0
    }
  };
};
function y(e) {
  var t;
  var n = e.children;
  var l = e.classes;
  var d = e.className;
  var f = e.fullScreen;
  var h = e.fullWidth;
  var m = e.disableBackdropClick;
  var y = e.disableEscapeKeyDown;
  var g = e.maxWidth;
  var v = e.onBackdropClick;
  var b = e.onClose;
  var _ = e.onEnter;
  var w = e.onEntered;
  var x = e.onEntering;
  var E = e.onEscapeKeyDown;
  var S = e.onExit;
  var T = e.onExited;
  var k = e.onExiting;
  var O = e.open;
  var P = e.PaperProps;
  var C = e.transition;
  var I = e.transitionDuration;
  var M = (0, o.default)(e, ["children", "classes", "className", "fullScreen", "fullWidth", "disableBackdropClick", "disableEscapeKeyDown", "maxWidth", "onBackdropClick", "onClose", "onEnter", "onEntered", "onEntering", "onEscapeKeyDown", "onExit", "onExited", "onExiting", "open", "PaperProps", "transition", "transitionDuration"]);
  return a.default.createElement(c.default, (0, r.default)({
    className: (0, s.default)(l.root, d),
    BackdropProps: {
      transitionDuration: I
    },
    disableBackdropClick: m,
    disableEscapeKeyDown: y,
    onBackdropClick: v,
    onEscapeKeyDown: E,
    onClose: b,
    open: O,
    role: "dialog"
  }, M), a.default.createElement(C, {
    appear: true,
    in: O,
    timeout: I,
    onEnter: _,
    onEntering: x,
    onEntered: w,
    onExit: S,
    onExiting: k,
    onExited: T
  }, a.default.createElement(p.default, (0, r.default)({
    elevation: 24,
    className: (0, s.default)(l.paper, (t = {}, (0, i.default)(t, l["paperWidth" + (g ? (0, u.capitalize)(g) : "")], g), (0, i.default)(t, l.fullScreen, f), (0, i.default)(t, l.fullWidth, h), t))
  }, P), n)));
}
y.propTypes = {};
y.defaultProps = {
  fullScreen: false,
  fullWidth: false,
  disableBackdropClick: false,
  disableEscapeKeyDown: false,
  maxWidth: "sm",
  transition: d.default,
  transitionDuration: {
    enter: f.duration.enteringScreen,
    exit: f.duration.leavingScreen
  }
};
exports.default = (0, l.default)(m, {
  name: "MuiDialog"
})(y);