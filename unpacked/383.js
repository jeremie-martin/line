Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = v(require("./3.js"));
var i = v(require("./4.js"));
var o = v(require("./126.js"));
var a = v(require("./10.js"));
var s = v(require("./9.js"));
var l = v(require("./11.js"));
var u = v(require("./12.js"));
var c = v(require("./13.js"));
var d = v(require("./0.js"));
v(require("./1.js"));
var f = require("./21.js");
var p = v(require("./91.js"));
var h = v(require("./165.js"));
var m = v(require("./377.js"));
var y = v(require("./62.js"));
var g = v(require("./38.js"));
function v(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var b = function (e) {
  function t() {
    var e;
    var n;
    var r;
    var i;
    (0, s.default)(this, t);
    for (var o = arguments.length, l = Array(o), c = 0; c < o; c++) {
      l[c] = arguments[c];
    }
    n = r = (0, u.default)(this, (e = t.__proto__ || (0, a.default)(t)).call.apply(e, [this].concat(l)));
    r.state = {
      currentTabIndex: undefined
    };
    r.list = undefined;
    r.selectedItem = undefined;
    r.blurTimer = undefined;
    r.handleBlur = function (e) {
      r.blurTimer = setTimeout(function () {
        if (r.list) {
          var e = (0, f.findDOMNode)(r.list);
          var t = (0, m.default)((0, y.default)(e));
          if (!(0, h.default)(e, t)) {
            r.resetTabIndex();
          }
        }
      }, 30);
      if (r.props.onBlur) {
        r.props.onBlur(e);
      }
    };
    r.handleKeyDown = function (e) {
      var t = (0, f.findDOMNode)(r.list);
      var n = (0, p.default)(e);
      var i = (0, m.default)((0, y.default)(t));
      if (n !== "up" && n !== "down" || i && (!i || (0, h.default)(t, i))) {
        if (n === "down") {
          e.preventDefault();
          if (i.nextElementSibling) {
            i.nextElementSibling.focus();
          }
        } else if (n === "up") {
          e.preventDefault();
          if (i.previousElementSibling) {
            i.previousElementSibling.focus();
          }
        }
      } else if (r.selectedItem) {
        (0, f.findDOMNode)(r.selectedItem).focus();
      } else {
        t.firstChild.focus();
      }
      if (r.props.onKeyDown) {
        r.props.onKeyDown(e, n);
      }
    };
    r.handleItemFocus = function (e) {
      var t = (0, f.findDOMNode)(r.list);
      if (t) {
        for (var n = 0; n < t.children.length; n += 1) {
          if (t.children[n] === e.currentTarget) {
            r.setTabIndex(n);
            break;
          }
        }
      }
    };
    i = n;
    return (0, u.default)(r, i);
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "componentDidMount",
    value: function () {
      this.resetTabIndex();
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      clearTimeout(this.blurTimer);
    }
  }, {
    key: "setTabIndex",
    value: function (e) {
      this.setState({
        currentTabIndex: e
      });
    }
  }, {
    key: "focus",
    value: function () {
      var e = this.state.currentTabIndex;
      var t = (0, f.findDOMNode)(this.list);
      if (t && t.children && t.firstChild) {
        if (e && e >= 0) {
          t.children[e].focus();
        } else {
          t.firstChild.focus();
        }
      }
    }
  }, {
    key: "resetTabIndex",
    value: function () {
      var e = (0, f.findDOMNode)(this.list);
      var t = (0, m.default)((0, y.default)(e));
      var n = [].concat((0, o.default)(e.children));
      var r = n.indexOf(t);
      if (r !== -1) {
        return this.setTabIndex(r);
      } else if (this.selectedItem) {
        return this.setTabIndex(n.indexOf((0, f.findDOMNode)(this.selectedItem)));
      } else {
        return this.setTabIndex(0);
      }
    }
  }, {
    key: "render",
    value: function () {
      var e = this;
      var t = this.props;
      var n = t.children;
      var o = t.className;
      t.onBlur;
      t.onKeyDown;
      var a = (0, i.default)(t, ["children", "className", "onBlur", "onKeyDown"]);
      return d.default.createElement(g.default, (0, r.default)({
        role: "menu",
        ref: function (t) {
          e.list = t;
        },
        className: o,
        onKeyDown: this.handleKeyDown,
        onBlur: this.handleBlur
      }, a), d.default.Children.map(n, function (t, n) {
        if (d.default.isValidElement(t)) {
          return d.default.cloneElement(t, {
            tabIndex: n === e.state.currentTabIndex ? 0 : -1,
            ref: t.props.selected ? function (t) {
              e.selectedItem = t;
            } : undefined,
            onFocus: e.handleItemFocus
          });
        } else {
          return null;
        }
      }));
    }
  }]);
  return t;
}(d.default.Component);
b.propTypes = {};
exports.default = b;