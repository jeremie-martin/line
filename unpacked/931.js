Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = l(require("./0.js"));
l(require("./1.js"));
var i = l(require("./5.js"));
var o = l(require("./932.js"));
var a = l(require("./2.js"));
var s = l(require("./933.js"));
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
      display: "block"
    },
    completed: {
      fill: e.palette.primary.main
    }
  };
};
function c(e) {
  var t = e.completed;
  var n = e.icon;
  var a = e.active;
  var l = e.classes;
  if (typeof n == "number" || typeof n == "string") {
    if (t) {
      return r.default.createElement(o.default, {
        className: (0, i.default)(l.root, l.completed)
      });
    } else {
      return r.default.createElement(s.default, {
        className: l.root,
        position: n,
        active: a
      });
    }
  } else {
    return n;
  }
}
c.propTypes = {};
exports.default = (0, a.default)(u, {
  name: "MuiStepIcon"
})(c);