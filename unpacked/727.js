Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = m(require("./3.js"));
var i = m(require("./6.js"));
var o = m(require("./10.js"));
var a = m(require("./9.js"));
var s = m(require("./11.js"));
var l = m(require("./12.js"));
var u = m(require("./13.js"));
var c = m(require("./0.js"));
var d = m(require("./1.js"));
m(require("./14.js"));
var f = m(require("./261.js"));
var p = require("./237.js");
var h = m(p);
m(require("./163.js"));
function m(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var y = function (e) {
  function t(e, n) {
    (0, a.default)(this, t);
    var r = (0, l.default)(this, (t.__proto__ || (0, o.default)(t)).call(this, e, n));
    r.broadcast = (0, f.default)();
    r.unsubscribeId = null;
    r.outerTheme = null;
    r.outerTheme = h.default.initial(n);
    r.broadcast.setState(r.mergeOuterLocalTheme(r.props.theme));
    return r;
  }
  (0, u.default)(t, e);
  (0, s.default)(t, [{
    key: "getChildContext",
    value: function () {
      var e;
      e = {};
      (0, i.default)(e, p.CHANNEL, this.broadcast);
      (0, i.default)(e, "muiThemeProviderOptions", {
        sheetsManager: this.props.sheetsManager,
        disableStylesGeneration: this.props.disableStylesGeneration
      });
      return e;
    }
  }, {
    key: "componentDidMount",
    value: function () {
      var e = this;
      this.unsubscribeId = h.default.subscribe(this.context, function (t) {
        e.outerTheme = t;
        e.broadcast.setState(e.mergeOuterLocalTheme(e.props.theme));
      });
    }
  }, {
    key: "componentWillReceiveProps",
    value: function (e) {
      if (this.props.theme !== e.theme) {
        this.broadcast.setState(this.mergeOuterLocalTheme(e.theme));
      }
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      if (this.unsubscribeId !== null) {
        h.default.unsubscribe(this.context, this.unsubscribeId);
      }
    }
  }, {
    key: "mergeOuterLocalTheme",
    value: function (e) {
      if (typeof e == "function") {
        return e(this.outerTheme);
      } else if (this.outerTheme) {
        return (0, r.default)({}, this.outerTheme, e);
      } else {
        return e;
      }
    }
  }, {
    key: "render",
    value: function () {
      return this.props.children;
    }
  }]);
  return t;
}(c.default.Component);
y.propTypes = {};
y.propTypes = {};
y.defaultProps = {
  disableStylesGeneration: false,
  sheetsManager: null
};
y.childContextTypes = (0, r.default)({}, h.default.contextTypes, {
  muiThemeProviderOptions: d.default.object
});
y.contextTypes = h.default.contextTypes;
exports.default = y;