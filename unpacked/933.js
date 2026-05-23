Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = l(require("./6.js"));
var i = l(require("./0.js"));
l(require("./1.js"));
var o = l(require("./5.js"));
var a = l(require("./2.js"));
var s = l(require("./23.js"));
function l(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var u = exports.styles = function (e) {
  return {
    root: {
      fill: e.palette.action.disabled
    },
    active: {
      fill: e.palette.primary.main
    },
    text: {
      fill: e.palette.primary.contrastText,
      fontSize: e.typography.caption.fontSize,
      fontFamily: e.typography.fontFamily
    }
  };
};
var c = i.default.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "10"
});
function d(e) {
  var t = e.position;
  var n = e.classes;
  var a = e.className;
  var l = e.active;
  var u = (0, o.default)(n.root, (0, r.default)({}, n.active, l), a);
  return i.default.createElement(s.default, {
    className: u
  }, c, i.default.createElement("text", {
    className: n.text,
    x: "12",
    y: "16",
    textAnchor: "middle"
  }, t));
}
d.propTypes = {};
exports.default = (0, a.default)(u, {
  name: "MuiStepPosition"
})(d);