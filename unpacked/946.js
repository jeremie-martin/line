Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = x(require("./3.js"));
var i = x(require("./4.js"));
var o = x(require("./356.js"));
var a = x(require("./10.js"));
var s = x(require("./9.js"));
var l = x(require("./11.js"));
var u = x(require("./12.js"));
var c = x(require("./13.js"));
var d = x(require("./6.js"));
var f = x(require("./0.js"));
x(require("./1.js"));
x(require("./14.js"));
var p = x(require("./5.js"));
var h = x(require("./44.js"));
var m = x(require("./56.js"));
var y = x(require("./947.js"));
var g = require("./950.js");
var v = x(require("./951.js"));
var b = x(require("./2.js"));
var _ = x(require("./954.js"));
var w = x(require("./955.js"));
function x(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var E = exports.styles = function (e) {
  return {
    root: {
      overflow: "hidden",
      minHeight: 48,
      WebkitOverflowScrolling: "touch"
    },
    flexContainer: {
      display: "flex"
    },
    scrollingContainer: {
      position: "relative",
      display: "inline-block",
      flex: "1 1 auto",
      whiteSpace: "nowrap"
    },
    fixed: {
      overflowX: "hidden",
      width: "100%"
    },
    scrollable: {
      overflowX: "scroll"
    },
    centered: {
      justifyContent: "center"
    },
    buttonAuto: (0, d.default)({}, e.breakpoints.down("xs"), {
      display: "none"
    })
  };
};
var S = function (e) {
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
      indicatorStyle: {},
      scrollerStyle: {
        marginBottom: 0
      },
      showLeftScroll: false,
      showRightScroll: false,
      mounted: false
    };
    r.getConditionalElements = function () {
      var e = r.props;
      var t = e.classes;
      var n = e.buttonClassName;
      var i = e.scrollable;
      var o = e.scrollButtons;
      var a = e.TabScrollButton;
      var s = e.theme;
      var l = {};
      l.scrollbarSizeListener = i ? f.default.createElement(y.default, {
        onLoad: r.handleScrollbarSizeChange,
        onChange: r.handleScrollbarSizeChange
      }) : null;
      var u = i && (o === "auto" || o === "on");
      l.scrollButtonLeft = u ? f.default.createElement(a, {
        direction: s && s.direction === "rtl" ? "right" : "left",
        onClick: r.handleLeftScrollClick,
        visible: r.state.showLeftScroll,
        className: (0, p.default)((0, d.default)({}, t.buttonAuto, o === "auto"), n)
      }) : null;
      l.scrollButtonRight = u ? f.default.createElement(a, {
        direction: s && s.direction === "rtl" ? "left" : "right",
        onClick: r.handleRightScrollClick,
        visible: r.state.showRightScroll,
        className: (0, p.default)((0, d.default)({}, t.buttonAuto, o === "auto"), n)
      }) : null;
      return l;
    };
    r.getTabsMeta = function (e, t) {
      var n = undefined;
      if (r.tabs) {
        var i = r.tabs.getBoundingClientRect();
        n = {
          clientWidth: r.tabs ? r.tabs.clientWidth : 0,
          scrollLeft: r.tabs ? r.tabs.scrollLeft : 0,
          scrollLeftNormalized: r.tabs ? (0, g.getNormalizedScrollLeft)(r.tabs, t) : 0,
          scrollWidth: r.tabs ? r.tabs.scrollWidth : 0,
          left: i.left,
          right: i.right
        };
      }
      var o = undefined;
      if (r.tabs && e !== false) {
        var a = r.tabs.children[0].children;
        if (a.length > 0) {
          var s = a[r.valueToIndex[e]];
          o = s ? s.getBoundingClientRect() : null;
        }
      }
      return {
        tabsMeta: n,
        tabMeta: o
      };
    };
    r.tabs = undefined;
    r.valueToIndex = {};
    r.handleResize = (0, m.default)(function () {
      r.updateIndicatorState(r.props);
      r.updateScrollButtonState();
    }, 166);
    r.handleLeftScrollClick = function () {
      if (r.tabs) {
        r.moveTabsScroll(-r.tabs.clientWidth);
      }
    };
    r.handleRightScrollClick = function () {
      if (r.tabs) {
        r.moveTabsScroll(r.tabs.clientWidth);
      }
    };
    r.handleScrollbarSizeChange = function (e) {
      var t = e.scrollbarHeight;
      r.setState({
        scrollerStyle: {
          marginBottom: -t
        }
      });
    };
    r.handleTabsScroll = (0, m.default)(function () {
      r.updateScrollButtonState();
    }, 166);
    r.moveTabsScroll = function (e) {
      var t = r.props.theme;
      if (r.tabs) {
        var n = t.direction === "rtl" ? -1 : 1;
        var i = r.tabs.scrollLeft + e * n;
        var o = t.direction === "rtl" && (0, g.detectScrollType)() === "reverse" ? -1 : 1;
        v.default.left(r.tabs, o * i);
      }
    };
    r.scrollSelectedIntoView = function () {
      var e = r.props;
      var t = e.theme;
      var n = e.value;
      var i = r.getTabsMeta(n, t.direction);
      var o = i.tabsMeta;
      var a = i.tabMeta;
      if (a && o) {
        if (a.left < o.left) {
          var s = o.scrollLeft + (a.left - o.left);
          v.default.left(r.tabs, s);
        } else if (a.right > o.right) {
          var l = o.scrollLeft + (a.right - o.right);
          v.default.left(r.tabs, l);
        }
      }
    };
    r.updateScrollButtonState = function () {
      var e = r.props;
      var t = e.scrollable;
      var n = e.scrollButtons;
      var i = e.theme;
      if (r.tabs && t && n !== "off") {
        var o = r.tabs;
        var a = o.scrollWidth;
        var s = o.clientWidth;
        var l = (0, g.getNormalizedScrollLeft)(r.tabs, i.direction);
        var u = i.direction === "rtl" ? a > s + l : l > 0;
        var c = i.direction === "rtl" ? l > 0 : a > s + l;
        if (u !== r.state.showLeftScroll || c !== r.state.showRightScroll) {
          r.setState({
            showLeftScroll: u,
            showRightScroll: c
          });
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
      this.setState({
        mounted: true
      });
      this.updateIndicatorState(this.props);
      this.updateScrollButtonState();
      if (this.props.action) {
        this.props.action({
          updateIndicator: this.handleResize
        });
      }
    }
  }, {
    key: "componentDidUpdate",
    value: function (e, t) {
      this.updateScrollButtonState();
      this.updateIndicatorState(this.props);
      if (this.state.indicatorStyle !== t.indicatorStyle) {
        this.scrollSelectedIntoView();
      }
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      this.handleResize.cancel();
      this.handleTabsScroll.cancel();
    }
  }, {
    key: "updateIndicatorState",
    value: function (e) {
      var t = e.theme;
      var n = e.value;
      var r = this.getTabsMeta(n, t.direction);
      var i = r.tabsMeta;
      var a = r.tabMeta;
      var s = 0;
      if (a && i) {
        var l = t.direction === "rtl" ? i.scrollLeftNormalized + i.clientWidth - i.scrollWidth : i.scrollLeft;
        s = a.left - i.left + l;
      }
      var u = {
        left: s,
        width: a ? a.width : 0
      };
      if ((u.left !== this.state.indicatorStyle.left || u.width !== this.state.indicatorStyle.width) && !(0, o.default)(u.left) && !(0, o.default)(u.width)) {
        this.setState({
          indicatorStyle: u
        });
      }
    }
  }, {
    key: "render",
    value: function () {
      var e;
      var t = this;
      var n = this.props;
      n.action;
      n.buttonClassName;
      var o = n.centered;
      var a = n.children;
      var s = n.classes;
      var l = n.className;
      var u = n.fullWidth;
      var c = n.indicatorClassName;
      var m = n.indicatorColor;
      var y = n.onChange;
      var g = n.scrollable;
      n.scrollButtons;
      n.TabScrollButton;
      var v = n.textColor;
      n.theme;
      var b = n.value;
      var w = (0, i.default)(n, ["action", "buttonClassName", "centered", "children", "classes", "className", "fullWidth", "indicatorClassName", "indicatorColor", "onChange", "scrollable", "scrollButtons", "TabScrollButton", "textColor", "theme", "value"]);
      var x = (0, p.default)(s.root, l);
      var E = (0, p.default)(s.scrollingContainer, (e = {}, (0, d.default)(e, s.fixed, !g), (0, d.default)(e, s.scrollable, g), e));
      var S = (0, p.default)(s.flexContainer, (0, d.default)({}, s.centered, o && !g));
      var T = f.default.createElement(_.default, {
        style: this.state.indicatorStyle,
        className: c,
        color: m
      });
      this.valueToIndex = {};
      var k = 0;
      var O = f.default.Children.map(a, function (e) {
        if (!f.default.isValidElement(e)) {
          return null;
        }
        var n = e.props.value || k;
        t.valueToIndex[n] = k;
        var r = n === b;
        k += 1;
        return f.default.cloneElement(e, {
          fullWidth: u,
          indicator: r && !t.state.mounted && T,
          selected: r,
          onChange: y,
          textColor: v,
          value: n
        });
      });
      var P = this.getConditionalElements();
      return f.default.createElement("div", (0, r.default)({
        className: x
      }, w), f.default.createElement(h.default, {
        target: "window",
        onResize: this.handleResize
      }), P.scrollbarSizeListener, f.default.createElement("div", {
        className: s.flexContainer
      }, P.scrollButtonLeft, f.default.createElement("div", {
        className: E,
        style: this.state.scrollerStyle,
        ref: function (e) {
          t.tabs = e;
        },
        role: "tablist",
        onScroll: this.handleTabsScroll
      }, f.default.createElement("div", {
        className: S
      }, O), this.state.mounted && T), P.scrollButtonRight));
    }
  }]);
  return t;
}(f.default.Component);
S.propTypes = {};
S.defaultProps = {
  centered: false,
  fullWidth: false,
  indicatorColor: "secondary",
  scrollable: false,
  scrollButtons: "auto",
  TabScrollButton: w.default,
  textColor: "inherit"
};
exports.default = (0, b.default)(E, {
  name: "MuiTabs",
  withTheme: true
})(S);