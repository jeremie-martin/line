Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = m(require("./10.js"));
var i = m(require("./9.js"));
var o = m(require("./11.js"));
var a = m(require("./12.js"));
var s = m(require("./13.js"));
var l = m(require("./155.js"));
var u = m(require("./40.js"));
var c = m(require("./4.js"));
var d = m(require("./321.js"));
exports.withOptions = function (e, t) {
  return {
    handler: e,
    options: g(t)
  };
};
var f = m(require("./0.js"));
m(require("./1.js"));
var p = m(require("./197.js"));
m(require("./14.js"));
var h = require("./730.js");
function m(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var y = {
  capture: false,
  passive: false
};
function g(e) {
  return (0, d.default)({}, y, e);
}
function v(e, t, n) {
  var r = [e, t];
  r.push(h.passiveOption ? n : n.capture);
  return r;
}
function b(e, t, n, r) {
  e.addEventListener.apply(e, v(t, n, r));
}
function _(e, t, n, r) {
  e.removeEventListener.apply(e, v(t, n, r));
}
var w = function (e) {
  function t() {
    (0, i.default)(this, t);
    return (0, a.default)(this, (t.__proto__ || (0, r.default)(t)).apply(this, arguments));
  }
  (0, s.default)(t, e);
  (0, o.default)(t, [{
    key: "componentDidMount",
    value: function () {
      this.addListeners();
    }
  }, {
    key: "shouldComponentUpdate",
    value: function (e) {
      return !(0, p.default)(this.props, e);
    }
  }, {
    key: "componentWillUpdate",
    value: function () {
      this.removeListeners();
    }
  }, {
    key: "componentDidUpdate",
    value: function () {
      this.addListeners();
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      this.removeListeners();
    }
  }, {
    key: "addListeners",
    value: function () {
      this.applyListeners(b);
    }
  }, {
    key: "removeListeners",
    value: function () {
      this.applyListeners(_);
    }
  }, {
    key: "applyListeners",
    value: function (e) {
      var t = this.props.target;
      if (t) {
        var n = t;
        if (typeof t == "string") {
          n = window[t];
        }
        (function (e, t) {
          e.children;
          e.target;
          var n = (0, c.default)(e, ["children", "target"]);
          (0, u.default)(n).forEach(function (e) {
            if (e.substring(0, 2) === "on") {
              var r = n[e];
              var i = r === undefined ? "undefined" : (0, l.default)(r);
              var o = i === "object";
              if (o || i === "function") {
                var a = e.substr(-7).toLowerCase() === "capture";
                var s = e.substring(2).toLowerCase();
                s = a ? s.substring(0, s.length - 7) : s;
                if (o) {
                  t(s, r.handler, r.options);
                } else {
                  t(s, r, g({
                    capture: a
                  }));
                }
              }
            }
          });
        })(this.props, e.bind(null, n));
      }
    }
  }, {
    key: "render",
    value: function () {
      return this.props.children || null;
    }
  }]);
  return t;
}(f.default.Component);
w.propTypes = {};
exports.default = w;