exports.__esModule = true;
exports.classNamesShape = exports.timeoutsShape = undefined;
exports.transitionTimeout = function (e) {
  var t = "transition" + e + "Timeout";
  var n = "transition" + e;
  return function (e) {
    if (e[n]) {
      if (e[t] == null) {
        return new Error(t + " wasn't supplied to CSSTransitionGroup: this can cause unreliable animations and won't be supported in a future version of React. See https://fb.me/react-animation-transition-group-timeout for more information.");
      }
      if (typeof e[t] != "number") {
        return new Error(t + " must be a number (in milliseconds)");
      }
    }
    return null;
  };
};
var r;
var i = require("./1.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
exports.timeoutsShape = o.default.oneOfType([o.default.number, o.default.shape({
  enter: o.default.number,
  exit: o.default.number
}).isRequired]);
exports.classNamesShape = o.default.oneOfType([o.default.string, o.default.shape({
  enter: o.default.string,
  exit: o.default.string,
  active: o.default.string
}), o.default.shape({
  enter: o.default.string,
  enterDone: o.default.string,
  enterActive: o.default.string,
  exit: o.default.string,
  exitDone: o.default.string,
  exitActive: o.default.string
})]);