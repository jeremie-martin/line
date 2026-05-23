Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = c(require("./3.js"));
var i = c(require("./6.js"));
var o = c(require("./4.js"));
var a = c(require("./0.js"));
c(require("./1.js"));
c(require("./14.js"));
var s = c(require("./5.js"));
var l = c(require("./173.js"));
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
      marginTop: e.spacing.unit,
      marginLeft: 12,
      paddingLeft: e.spacing.unit + 12,
      paddingRight: e.spacing.unit,
      borderLeft: "1px solid " + (e.palette.type === "light" ? e.palette.grey[400] : e.palette.grey[600])
    },
    last: {
      borderLeft: "none"
    },
    transition: {}
  };
};
function f(e) {
  var t = e.active;
  e.alternativeLabel;
  var n = e.children;
  var l = e.classes;
  var u = e.className;
  e.completed;
  var c = e.last;
  e.optional;
  e.orientation;
  var d = e.transition;
  var f = e.transitionDuration;
  var p = (0, o.default)(e, ["active", "alternativeLabel", "children", "classes", "className", "completed", "last", "optional", "orientation", "transition", "transitionDuration"]);
  var h = (0, s.default)(l.root, (0, i.default)({}, l.last, c), u);
  return a.default.createElement("div", (0, r.default)({
    className: h
  }, p), a.default.createElement(d, {
    in: t,
    className: l.transition,
    timeout: f,
    unmountOnExit: true
  }, n));
}
f.propTypes = {};
f.defaultProps = {
  transition: l.default,
  transitionDuration: "auto"
};
exports.default = (0, u.default)(d, {
  name: "MuiStepContent"
})(f);