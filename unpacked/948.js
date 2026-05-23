Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = f(require("./10.js"));
var i = f(require("./9.js"));
var o = f(require("./11.js"));
var a = f(require("./12.js"));
var s = f(require("./13.js"));
var l = require("./0.js");
var u = f(l);
f(require("./1.js"));
var c = f(require("./44.js"));
var d = f(require("./949.js"));
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var p = {
  width: "100px",
  height: "100px",
  position: "absolute",
  top: "-100000px",
  overflow: "scroll",
  msOverflowStyle: "scrollbar"
};
var h = function (e) {
  function t() {
    var e;
    var n;
    var o;
    var s;
    (0, i.default)(this, t);
    for (var l = arguments.length, u = Array(l), c = 0; c < l; c++) {
      u[c] = arguments[c];
    }
    n = o = (0, a.default)(this, (e = t.__proto__ || (0, r.default)(t)).call.apply(e, [this].concat(u)));
    o.setMeasurements = function () {
      o.scrollbarHeight = o.node.offsetHeight - o.node.clientHeight;
      o.scrollbarWidth = o.node.offsetWidth - o.node.clientWidth;
    };
    o.handleResize = (0, d.default)(function () {
      var e = o.props.onChange;
      var t = o.scrollbarHeight;
      var n = o.scrollbarWidth;
      o.setMeasurements();
      if (t !== o.scrollbarHeight || n !== o.scrollbarWidth) {
        e({
          scrollbarHeight: o.scrollbarHeight,
          scrollbarWidth: o.scrollbarWidth
        });
      }
    }, 166);
    s = n;
    return (0, a.default)(o, s);
  }
  (0, s.default)(t, e);
  (0, o.default)(t, [{
    key: "componentDidMount",
    value: function () {
      var e = this.props.onLoad;
      if (e) {
        this.setMeasurements();
        e({
          scrollbarHeight: this.scrollbarHeight,
          scrollbarWidth: this.scrollbarWidth
        });
      }
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      this.handleResize.cancel();
    }
  }, {
    key: "render",
    value: function () {
      var e = this;
      var t = this.props.onChange;
      return u.default.createElement("div", null, t ? u.default.createElement(c.default, {
        target: "window",
        onResize: this.handleResize
      }) : null, u.default.createElement("div", {
        style: p,
        ref: function (t) {
          e.node = t;
        }
      }));
    }
  }]);
  return t;
}(l.Component);
h.defaultProps = {
  onLoad: null,
  onChange: null
};
exports.default = h;