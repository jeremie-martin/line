Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = u(require("./3.js"));
var i = u(require("./4.js"));
var o = u(require("./0.js"));
u(require("./1.js"));
var a = u(require("./248.js"));
var s = u(require("./889.js"));
var l = u(require("./2.js"));
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
    default: {
      color: e.palette.text.secondary
    },
    checked: {
      color: e.palette.primary.main
    },
    disabled: {
      color: e.palette.action.disabled
    }
  };
};
function d(e) {
  var t = e.checkedIcon;
  var n = e.icon;
  var s = e.indeterminate;
  var l = e.indeterminateIcon;
  var u = (0, i.default)(e, ["checkedIcon", "icon", "indeterminate", "indeterminateIcon"]);
  return o.default.createElement(a.default, (0, r.default)({
    checkedIcon: s ? l : t,
    icon: s ? l : n
  }, u));
}
d.propTypes = {};
d.defaultProps = {
  indeterminate: false,
  indeterminateIcon: o.default.createElement(s.default, null)
};
exports.default = (0, l.default)(c, {
  name: "MuiCheckbox"
})(d);