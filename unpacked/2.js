Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sheetsManager = undefined;
var r = S(require("./40.js"));
var i = S(require("./3.js"));
var o = S(require("./10.js"));
var a = S(require("./9.js"));
var s = S(require("./11.js"));
var l = S(require("./12.js"));
var u = S(require("./13.js"));
var c = S(require("./4.js"));
var d = S(require("./667.js"));
var f = S(require("./683.js"));
var p = S(require("./0.js"));
var h = S(require("./1.js"));
S(require("./14.js"));
var m = S(require("./159.js"));
S(require("./337.js"));
S(require("./119.js"));
var y = S(require("./338.js"));
var g = require("./339.js");
var v = function (e) {
  if (e && e.__esModule) {
    return e;
  }
  var t = {};
  if (e != null) {
    for (var n in e) {
      if (Object.prototype.hasOwnProperty.call(e, n)) {
        t[n] = e[n];
      }
    }
  }
  t.default = e;
  return t;
}(require("./231.js"));
var b = S(require("./345.js"));
var _ = S(require("./235.js"));
var w = S(require("./237.js"));
var x = S(require("./357.js"));
var E = S(require("./721.js"));
function S(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var T = (0, g.create)((0, b.default)());
var k = (0, x.default)();
var O = f.default;
var P = exports.sheetsManager = new d.default();
var C = {};
var I = undefined;
exports.default = function (e, t = {}) {
  return function (n) {
    var f = t.withTheme;
    var g = f !== undefined && f;
    var b = t.flip;
    var x = b === undefined ? null : b;
    var S = t.name;
    var M = (0, c.default)(t, ["withTheme", "flip", "name"]);
    var L = (0, E.default)(e);
    var R = L.themingEnabled || g || typeof S == "string";
    O += 1;
    L.options.index = O;
    var A = function (e) {
      function t(e, n) {
        (0, a.default)(this, t);
        var r = (0, l.default)(this, (t.__proto__ || (0, o.default)(t)).call(this, e, n));
        r.state = {};
        r.disableStylesGeneration = false;
        r.jss = null;
        r.sheetOptions = null;
        r.sheetsManager = P;
        r.stylesCreatorSaved = null;
        r.theme = null;
        r.unsubscribeId = null;
        r.jss = r.context[v.jss] || T;
        var s = r.context.muiThemeProviderOptions;
        if (s) {
          if (s.sheetsManager) {
            r.sheetsManager = s.sheetsManager;
          }
          r.disableStylesGeneration = s.disableStylesGeneration;
        }
        r.stylesCreatorSaved = L;
        r.sheetOptions = (0, i.default)({
          generateClassName: k
        }, r.context[v.sheetOptions]);
        r.theme = R ? w.default.initial(n) || I || (I = (0, _.default)()) : C;
        return r;
      }
      (0, u.default)(t, e);
      (0, s.default)(t, [{
        key: "componentWillMount",
        value: function () {
          this.attach(this.theme);
        }
      }, {
        key: "componentDidMount",
        value: function () {
          var e = this;
          if (R) {
            this.unsubscribeId = w.default.subscribe(this.context, function (t) {
              var n = e.theme;
              e.theme = t;
              e.attach(e.theme);
              e.setState({}, function () {
                e.detach(n);
              });
            });
          }
        }
      }, {
        key: "componentWillReceiveProps",
        value: function () {
          this.stylesCreatorSaved;
        }
      }, {
        key: "componentWillUnmount",
        value: function () {
          this.detach(this.theme);
          if (this.unsubscribeId !== null) {
            w.default.unsubscribe(this.context, this.unsubscribeId);
          }
        }
      }, {
        key: "attach",
        value: function (e) {
          if (!this.disableStylesGeneration) {
            var t = this.stylesCreatorSaved;
            var n = this.sheetsManager.get(t);
            if (!n) {
              n = new d.default();
              this.sheetsManager.set(t, n);
            }
            var r = n.get(e);
            if (!r) {
              r = {
                refs: 0,
                sheet: null
              };
              n.set(e, r);
            }
            if (r.refs === 0) {
              var o = t.create(e, S);
              var a = S;
              var s = this.jss.createStyleSheet(o, (0, i.default)({
                meta: a,
                classNamePrefix: a,
                flip: typeof x == "boolean" ? x : e.direction === "rtl",
                link: false
              }, this.sheetOptions, t.options, {
                name: S
              }, M));
              r.sheet = s;
              s.attach();
              var l = this.context[v.sheetsRegistry];
              if (l) {
                l.add(s);
              }
            }
            r.refs += 1;
          }
        }
      }, {
        key: "detach",
        value: function (e) {
          if (!this.disableStylesGeneration) {
            var t = this.stylesCreatorSaved;
            var n = this.sheetsManager.get(t);
            var r = n.get(e);
            r.refs -= 1;
            if (r.refs === 0) {
              n.delete(e);
              this.jss.removeStyleSheet(r.sheet);
              var i = this.context[v.sheetsRegistry];
              if (i) {
                i.remove(r.sheet);
              }
            }
          }
        }
      }, {
        key: "render",
        value: function () {
          var e = this.props;
          var t = e.classes;
          var o = e.innerRef;
          var a = (0, c.default)(e, ["classes", "innerRef"]);
          var s = undefined;
          var l = {};
          if (!this.disableStylesGeneration) {
            var u = this.sheetsManager.get(this.stylesCreatorSaved).get(this.theme);
            l = u.sheet.classes;
          }
          s = t ? (0, i.default)({}, l, (0, r.default)(t).reduce(function (e, n) {
            if (t[n]) {
              e[n] = l[n] + " " + t[n];
            }
            return e;
          }, {})) : l;
          var d = {};
          if (g) {
            d.theme = this.theme;
          }
          return p.default.createElement(n, (0, i.default)({
            classes: s
          }, d, a, {
            ref: o
          }));
        }
      }]);
      return t;
    }(p.default.Component);
    A.propTypes = {};
    A.contextTypes = (0, i.default)({
      muiThemeProviderOptions: h.default.object
    }, y.default, R ? w.default.contextTypes : {});
    (0, m.default)(A, n);
    return A;
  };
};