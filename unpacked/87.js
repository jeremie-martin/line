Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = p(require("./3.js"));
var i = p(require("./10.js"));
var o = p(require("./9.js"));
var a = p(require("./11.js"));
var s = p(require("./12.js"));
var l = p(require("./13.js"));
var u = p(require("./0.js"));
var c = p(require("./159.js"));
p(require("./119.js"));
var d = p(require("./235.js"));
var f = p(require("./237.js"));
function p(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var h = undefined;
exports.default = function () {
  return function (e) {
    var t = function (t) {
      function n(e, t) {
        (0, o.default)(this, n);
        var r = (0, s.default)(this, (n.__proto__ || (0, i.default)(n)).call(this, e, t));
        r.state = {};
        r.unsubscribeId = null;
        r.state = {
          theme: f.default.initial(t) || h || (h = (0, d.default)())
        };
        return r;
      }
      (0, l.default)(n, t);
      (0, a.default)(n, [{
        key: "componentDidMount",
        value: function () {
          var e = this;
          this.unsubscribeId = f.default.subscribe(this.context, function (t) {
            e.setState({
              theme: t
            });
          });
        }
      }, {
        key: "componentWillUnmount",
        value: function () {
          if (this.unsubscribeId !== null) {
            f.default.unsubscribe(this.context, this.unsubscribeId);
          }
        }
      }, {
        key: "render",
        value: function () {
          return u.default.createElement(e, (0, r.default)({
            theme: this.state.theme
          }, this.props));
        }
      }]);
      return n;
    }(u.default.Component);
    t.contextTypes = f.default.contextTypes;
    (0, c.default)(t, e);
    return t;
  };
};