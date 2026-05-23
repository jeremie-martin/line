Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = c(require("./3.js"));
var i = c(require("./6.js"));
var o = c(require("./4.js"));
var a = c(require("./0.js"));
c(require("./1.js"));
var s = c(require("./5.js"));
var l = c(require("./2.js"));
var u = c(require("./128.js"));
function c(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var d = exports.styles = {
  root: {
    zIndex: -1,
    width: "100%",
    height: "100%",
    position: "fixed",
    top: 0,
    left: 0,
    WebkitTapHighlightColor: "transparent",
    willChange: "opacity",
    backgroundColor: "rgba(0, 0, 0, 0.5)"
  },
  invisible: {
    backgroundColor: "transparent"
  }
};
function f(e) {
  var t = e.classes;
  var n = e.invisible;
  var l = e.open;
  var c = e.transitionDuration;
  var d = (0, o.default)(e, ["classes", "invisible", "open", "transitionDuration"]);
  var f = (0, s.default)(t.root, (0, i.default)({}, t.invisible, n));
  return a.default.createElement(u.default, (0, r.default)({
    appear: true,
    in: l,
    timeout: c
  }, d), a.default.createElement("div", {
    className: f,
    "aria-hidden": "true"
  }));
}
f.propTypes = {};
f.defaultProps = {
  invisible: false
};
exports.default = (0, l.default)(d, {
  name: "MuiBackdrop"
})(f);