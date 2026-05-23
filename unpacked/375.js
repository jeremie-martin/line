Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = y(require("./3.js"));
var i = y(require("./4.js"));
var o = y(require("./10.js"));
var a = y(require("./9.js"));
var s = y(require("./11.js"));
var l = y(require("./12.js"));
var u = y(require("./13.js"));
var c = y(require("./0.js"));
y(require("./1.js"));
var d = require("./21.js");
var f = y(require("./376.js"));
var p = y(require("./2.js"));
var h = y(require("./243.js"));
var m = y(require("./383.js"));
function y(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var g = {
  vertical: "top",
  horizontal: "right"
};
var v = {
  vertical: "top",
  horizontal: "left"
};
var b = exports.styles = {
  paper: {
    maxHeight: "calc(100vh - 96px)",
    WebkitOverflowScrolling: "touch"
  }
};
var _ = function (e) {
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
    r.getContentAnchorEl = function () {
      if (r.menuList && r.menuList.selectedItem) {
        return (0, d.findDOMNode)(r.menuList.selectedItem);
      } else {
        return (0, d.findDOMNode)(r.menuList).firstChild;
      }
    };
    r.menuList = undefined;
    r.focus = function () {
      if (r.menuList && r.menuList.selectedItem) {
        (0, d.findDOMNode)(r.menuList.selectedItem).focus();
      } else {
        var e = (0, d.findDOMNode)(r.menuList);
        if (e && e.firstChild) {
          e.firstChild.focus();
        }
      }
    };
    r.handleEnter = function (e) {
      var t = r.props.theme;
      var n = (0, d.findDOMNode)(r.menuList);
      r.focus();
      if (n && e.clientHeight < n.clientHeight && !n.style.width) {
        var i = (0, f.default)() + "px";
        n.style[t.direction === "rtl" ? "paddingLeft" : "paddingRight"] = i;
        n.style.width = "calc(100% + " + i + ")";
      }
      if (r.props.onEnter) {
        r.props.onEnter(e);
      }
    };
    r.handleListKeyDown = function (e, t) {
      if (t === "tab") {
        e.preventDefault();
        if (r.props.onClose) {
          r.props.onClose(e);
        }
      }
    };
    i = n;
    return (0, l.default)(r, i);
  }
  (0, u.default)(t, e);
  (0, s.default)(t, [{
    key: "componentDidMount",
    value: function () {
      if (this.props.open) {
        this.focus();
      }
    }
  }, {
    key: "render",
    value: function () {
      var e = this;
      var t = this.props;
      var n = t.children;
      var o = t.classes;
      var a = t.MenuListProps;
      t.onEnter;
      var s = t.PaperProps;
      var l = s === undefined ? {} : s;
      var u = t.PopoverClasses;
      var d = t.theme;
      var f = (0, i.default)(t, ["children", "classes", "MenuListProps", "onEnter", "PaperProps", "PopoverClasses", "theme"]);
      return c.default.createElement(h.default, (0, r.default)({
        getContentAnchorEl: this.getContentAnchorEl,
        classes: u,
        onEnter: this.handleEnter,
        anchorOrigin: d.direction === "rtl" ? g : v,
        transformOrigin: d.direction === "rtl" ? g : v,
        PaperProps: (0, r.default)({}, l, {
          classes: (0, r.default)({}, l.classes, {
            root: o.paper
          })
        })
      }, f), c.default.createElement(m.default, (0, r.default)({
        role: "menu",
        onKeyDown: this.handleListKeyDown
      }, a, {
        ref: function (t) {
          e.menuList = t;
        }
      }), n));
    }
  }]);
  return t;
}(c.default.Component);
_.propTypes = {};
_.defaultProps = {
  transitionDuration: "auto"
};
exports.default = (0, p.default)(b, {
  name: "MuiMenu",
  withTheme: true
})(_);