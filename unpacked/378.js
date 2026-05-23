Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = u(require("./10.js"));
var i = u(require("./9.js"));
var o = u(require("./11.js"));
var a = u(require("./12.js"));
var s = u(require("./13.js"));
var l = u(require("./0.js"));
u(require("./1.js"));
function u(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var c = function (e) {
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
c.propTypes = {};
exports.default = c;