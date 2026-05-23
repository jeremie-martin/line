Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = p(require("./3.js"));
var i = p(require("./4.js"));
var o = p(require("./10.js"));
var a = p(require("./9.js"));
var s = p(require("./11.js"));
var l = p(require("./12.js"));
var u = p(require("./13.js"));
var c = p(require("./0.js"));
p(require("./1.js"));
var d = p(require("./393.js"));
var f = require("./20.js");
function p(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var h = function (e) {
  function t() {
    var e;
    var n;
    var r;
    var i;
    (0, a.default)(this, t);
    for (var s = arguments.length, u = Array(s), c = 0; c < s; c++) {
      u[c] = arguments[c];
    }
    n = r = (0, l.default)(this, (e = t.__proto__ || (0, o.default)(t)).call.apply(e, [this].concat(u)));
    r.radios = [];
    r.focus = function () {
      if (r.radios && r.radios.length) {
        var e = r.radios.filter(function (e) {
          return !e.disabled;
        });
        if (e.length) {
          var t = (0, f.find)(e, function (e) {
            return e.checked;
          });
          if (t) {
            t.focus();
          } else {
            e[0].focus();
          }
        }
      }
    };
    r.handleRadioChange = function (e, t) {
      if (t && r.props.onChange) {
        r.props.onChange(e, e.target.value);
      }
    };
    i = n;
    return (0, l.default)(r, i);
  }
  (0, u.default)(t, e);
  (0, s.default)(t, [{
    key: "render",
    value: function () {
      var e = this;
      var t = this.props;
      var n = t.children;
      var o = t.name;
      var a = t.value;
      t.onChange;
      var s = (0, i.default)(t, ["children", "name", "value", "onChange"]);
      this.radios = [];
      return c.default.createElement(d.default, (0, r.default)({
        role: "radiogroup"
      }, s), c.default.Children.map(n, function (t, n) {
        if (c.default.isValidElement(t)) {
          return c.default.cloneElement(t, {
            key: n,
            name: o,
            inputRef: function (t) {
              if (t) {
                e.radios.push(t);
              }
            },
            checked: a === t.props.value,
            onChange: e.handleRadioChange
          });
        } else {
          return null;
        }
      }));
    }
  }]);
  return t;
}(c.default.Component);
h.propTypes = {};
exports.default = h;