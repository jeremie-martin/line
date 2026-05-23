Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = c(require("./10.js"));
var i = c(require("./9.js"));
var o = c(require("./11.js"));
var a = c(require("./12.js"));
var s = c(require("./13.js"));
var l = c(require("./0.js"));
c(require("./1.js"));
var u = require("./59.js");
c(require("./163.js"));
function c(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var d = function (e) {
  function t() {
    (0, i.default)(this, t);
    return (0, a.default)(this, (t.__proto__ || (0, r.default)(t)).apply(this, arguments));
  }
  (0, s.default)(t, e);
  (0, o.default)(t, [{
    key: "render",
    value: function () {
      return this.props.children;
    }
  }]);
  return t;
}(l.default.Component);
d.propTypes = {};
d.propTypes = {};
d.defaultProps = {
  children: null
};
exports.default = (0, u.withStyles)(function (e) {
  return {
    "@global": {
      html: {
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        boxSizing: "border-box"
      },
      "*, *::before, *::after": {
        boxSizing: "inherit"
      },
      body: {
        margin: 0,
        backgroundColor: e.palette.background.default,
        "@media print": {
          backgroundColor: e.palette.common.white
        }
      }
    }
  };
}, {
  name: "MuiReboot"
})(d);