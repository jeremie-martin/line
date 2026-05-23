Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isWidthDown = exports.isWidthUp = undefined;
var r = y(require("./3.js"));
var i = y(require("./4.js"));
var o = y(require("./10.js"));
var a = y(require("./9.js"));
var s = y(require("./11.js"));
var l = y(require("./12.js"));
var u = y(require("./13.js"));
var c = y(require("./0.js"));
y(require("./1.js"));
var d = y(require("./44.js"));
var f = y(require("./56.js"));
y(require("./119.js"));
var p = y(require("./159.js"));
var h = y(require("./87.js"));
var m = require("./122.js");
function y(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.isWidthUp = function (e, t) {
  if (!(arguments.length > 2) || arguments[2] === undefined || arguments[2]) {
    return m.keys.indexOf(e) <= m.keys.indexOf(t);
  } else {
    return m.keys.indexOf(e) < m.keys.indexOf(t);
  }
};
exports.isWidthDown = function (e, t) {
  if (!(arguments.length > 2) || arguments[2] === undefined || arguments[2]) {
    return m.keys.indexOf(t) <= m.keys.indexOf(e);
  } else {
    return m.keys.indexOf(t) < m.keys.indexOf(e);
  }
};
exports.default = function (e = {}) {
  return function (t) {
    var n = e.resizeInterval;
    var y = n === undefined ? 166 : n;
    var g = e.withTheme;
    var v = g !== undefined && g;
    var b = function (e) {
      function n() {
        var e;
        var t;
        var r;
        var i;
        (0, a.default)(this, n);
        for (var s = arguments.length, u = Array(s), c = 0; c < s; c++) {
          u[c] = arguments[c];
        }
        t = r = (0, l.default)(this, (e = n.__proto__ || (0, o.default)(n)).call.apply(e, [this].concat(u)));
        r.state = {
          width: undefined
        };
        r.handleResize = (0, f.default)(function () {
          r.updateWidth(window.innerWidth);
        }, y);
        i = t;
        return (0, l.default)(r, i);
      }
      (0, u.default)(n, e);
      (0, s.default)(n, [{
        key: "componentDidMount",
        value: function () {
          this.updateWidth(window.innerWidth);
        }
      }, {
        key: "componentWillUnmount",
        value: function () {
          this.handleResize.cancel();
        }
      }, {
        key: "updateWidth",
        value: function (e) {
          var t = this.props.theme.breakpoints;
          for (var n = null, r = 1; n === null && r < m.keys.length;) {
            var i = m.keys[r];
            if (e < t.values[i]) {
              n = m.keys[r - 1];
              break;
            }
            r += 1;
          }
          if ((n = n || "xl") !== this.state.width) {
            this.setState({
              width: n
            });
          }
        }
      }, {
        key: "render",
        value: function () {
          var e = this.props;
          var n = e.initialWidth;
          var o = e.theme;
          var a = e.width;
          var s = (0, i.default)(e, ["initialWidth", "theme", "width"]);
          var l = (0, r.default)({
            width: a || this.state.width || n
          }, s);
          var u = {};
          if (v) {
            u.theme = o;
          }
          if (l.width === undefined) {
            return null;
          } else {
            return c.default.createElement(d.default, {
              target: "window",
              onResize: this.handleResize
            }, c.default.createElement(t, (0, r.default)({}, u, l)));
          }
        }
      }]);
      return n;
    }(c.default.Component);
    b.propTypes = {};
    (0, p.default)(b, t);
    return (0, h.default)()(b);
  };
};