Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = u(require("./3.js"));
var i = u(require("./0.js"));
u(require("./1.js"));
var o = u(require("./248.js"));
var a = u(require("./921.js"));
var s = u(require("./922.js"));
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
var d = i.default.createElement(s.default, null);
var f = i.default.createElement(a.default, null);
function p(e) {
  return i.default.createElement(o.default, (0, r.default)({
    inputType: "radio",
    icon: d,
    checkedIcon: f
  }, e));
}
p.propTypes = {};
exports.default = (0, l.default)(c, {
  name: "MuiRadio"
})(p);