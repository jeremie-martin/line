Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./3.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
exports.cloneChildrenWithClassName = function (e, t, n) {
  return a.Children.map(e, function (e) {
    return (0, a.isValidElement)(e) && (0, a.cloneElement)(e, (0, o.default)({
      className: e.props.hasOwnProperty("className") ? e.props.className + " " + t : t
    }, n));
  });
};
exports.isMuiElement = function (e, t) {
  return (0, a.isValidElement)(e) && t.indexOf(e.type.muiName) !== -1;
};
exports.isMuiComponent = function (e, t) {
  return t.indexOf(e.muiName) !== -1;
};
var a = require("./0.js");