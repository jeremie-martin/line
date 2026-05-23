Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = v(require("./3.js"));
var i = v(require("./6.js"));
var o = v(require("./4.js"));
var a = v(require("./10.js"));
var s = v(require("./9.js"));
var l = v(require("./11.js"));
var u = v(require("./12.js"));
var c = v(require("./13.js"));
var d = v(require("./0.js"));
v(require("./1.js"));
var f = v(require("./5.js"));
var p = v(require("./91.js"));
var h = v(require("./891.js"));
var m = v(require("./2.js"));
var y = require("./73.js");
var g = require("./45.js");
function v(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
require("./387.js");
var b = exports.styles = function (e) {
  var t = e.palette.type === "light" ? e.palette.grey[300] : e.palette.grey[700];
  var n = (0, y.fade)(e.palette.text.primary, 0.26);
  return {
    root: {
      fontFamily: e.typography.fontFamily,
      fontSize: e.typography.pxToRem(13),
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      height: 32,
      color: e.palette.getContrastText(t),
      backgroundColor: t,
      borderRadius: 16,
      whiteSpace: "nowrap",
      transition: e.transitions.create(),
      cursor: "default",
      outline: "none",
      border: "none",
      padding: 0
    },
    clickable: {
      WebkitTapHighlightColor: "transparent",
      cursor: "pointer",
      "&:hover, &:focus": {
        backgroundColor: (0, y.emphasize)(t, 0.08)
      },
      "&:active": {
        boxShadow: e.shadows[1],
        backgroundColor: (0, y.emphasize)(t, 0.12)
      }
    },
    deletable: {
      "&:focus": {
        backgroundColor: (0, y.emphasize)(t, 0.08)
      }
    },
    avatar: {
      marginRight: -4,
      width: 32,
      height: 32,
      color: e.palette.type === "light" ? e.palette.grey[700] : e.palette.grey[300],
      fontSize: e.typography.pxToRem(16)
    },
    avatarChildren: {
      width: 19,
      height: 19
    },
    label: {
      display: "flex",
      alignItems: "center",
      paddingLeft: 12,
      paddingRight: 12,
      userSelect: "none",
      whiteSpace: "nowrap",
      cursor: "inherit"
    },
    deleteIcon: {
      WebkitTapHighlightColor: "transparent",
      color: n,
      cursor: "pointer",
      height: "auto",
      margin: "0 4px 0 -8px",
      "&:hover": {
        color: (0, y.fade)(n, 0.4)
      }
    }
  };
};
var _ = function (e) {
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
    r.chipRef = null;
    r.handleDeleteIconClick = function (e) {
      e.stopPropagation();
      var t = r.props.onDelete;
      if (t) {
        t(e);
      }
    };
    r.handleKeyDown = function (e) {
      var t = r.props;
      var n = t.onClick;
      var i = t.onDelete;
      var o = t.onKeyDown;
      var a = (0, p.default)(e);
      if (!n || a !== "space" && a !== "enter") {
        if (i && a === "backspace") {
          e.preventDefault();
          i(e);
        } else if (a === "esc") {
          e.preventDefault();
          if (r.chipRef) {
            r.chipRef.blur();
          }
        }
      } else {
        e.preventDefault();
        n(e);
      }
      if (o) {
        o(e);
      }
    };
    i = n;
    return (0, u.default)(r, i);
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "render",
    value: function () {
      var e = this;
      var t = this.props;
      var n = t.avatar;
      var a = t.classes;
      var s = t.className;
      var l = t.component;
      var u = t.deleteIcon;
      var c = t.label;
      var p = t.onClick;
      var m = t.onDelete;
      t.onKeyDown;
      var y = t.tabIndex;
      var v = (0, o.default)(t, ["avatar", "classes", "className", "component", "deleteIcon", "label", "onClick", "onDelete", "onKeyDown", "tabIndex"]);
      var b = (0, f.default)(a.root, (0, i.default)({}, a.clickable, p), (0, i.default)({}, a.deletable, m), s);
      var _ = null;
      if (m) {
        _ = u ? (0, g.cloneChildrenWithClassName)(u, a.deleteIcon, {
          onClick: this.handleDeleteIconClick
        }) : d.default.createElement(h.default, {
          className: a.deleteIcon,
          onClick: this.handleDeleteIconClick
        });
      }
      var w = null;
      if (n && d.default.isValidElement(n)) {
        w = d.default.cloneElement(n, {
          className: (0, f.default)(a.avatar, n.props.className),
          childrenClassName: (0, f.default)(a.avatarChildren, n.props.childrenClassName)
        });
      }
      var x = y;
      x ||= p || m ? 0 : -1;
      return d.default.createElement(l, (0, r.default)({
        role: "button",
        className: b,
        tabIndex: x,
        onClick: p,
        onKeyDown: this.handleKeyDown,
        ref: function (t) {
          e.chipRef = t;
        }
      }, v), w, d.default.createElement("span", {
        className: a.label
      }, c), _);
    }
  }]);
  return t;
}(d.default.Component);
_.propTypes = {};
_.defaultProps = {
  component: "div"
};
exports.default = (0, m.default)(b, {
  name: "MuiChip"
})(_);