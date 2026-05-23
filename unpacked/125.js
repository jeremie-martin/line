Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.IconButton = exports.Button = undefined;
var r = Object.assign || function (e) {
  for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t];
    for (var r in n) {
      if (Object.prototype.hasOwnProperty.call(n, r)) {
        e[r] = n[r];
      }
    }
  }
  return e;
};
var i = f(require("./0.js"));
var o = f(require("./5.js"));
var a = f(require("./2.js"));
var s = f(require("./32.js"));
var l = require("./20.js");
var u = require("./45.js");
require("./23.js");
var c = require("./60.js");
var d = require("./361.js");
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function p(e, t) {
  var n = {};
  for (var r in e) {
    if (!(t.indexOf(r) >= 0)) {
      if (Object.prototype.hasOwnProperty.call(e, r)) {
        n[r] = e[r];
      }
    }
  }
  return n;
}
class h extends i.default.Component {
  getRipple() {
    return this.buttonBase && this.buttonBase.ripple;
  }
  componentDidMount() {
    this.componentDidUpdate({
      pressed: false,
      pulsating: false
    });
  }
  componentDidUpdate(e) {
    if (e.pressed !== this.props.pressed) {
      let e = this.getRipple();
      if (e) {
        if (this.props.pressed) {
          e.start();
        } else {
          e.stop({});
        }
      }
    }
    if (e.pulsating !== this.props.pulsating) {
      let e = this.getRipple();
      if (e) {
        if (this.props.pulsating) {
          e.pulsate();
        } else {
          e.stop({});
        }
      }
    }
  }
}
h.defaultProps = {
  pressed: false,
  pulsating: false
};
class m extends h {
  render() {
    var e = this.props;
    e.pressed;
    e.pulsating;
    const t = e.children;
    const n = e.classes;
    const a = e.className;
    const c = e.color;
    const d = e.disabled;
    const f = e.disableFocusRipple;
    const h = e.fab;
    const m = e.fullWidth;
    const y = e.mini;
    const g = e.raised;
    const v = e.size;
    const b = p(e, ["pressed", "pulsating", "children", "classes", "className", "color", "disabled", "disableFocusRipple", "fab", "fullWidth", "mini", "raised", "size"]);
    const _ = !g && !h;
    const w = (0, o.default)(n.root, {
      [n.raised]: g || h,
      [n.fab]: h,
      [n.mini]: h && y,
      [n.colorInherit]: c === "inherit",
      [n.flatPrimary]: _ && c === "primary",
      [n.flatSecondary]: _ && c === "secondary",
      [n.raisedPrimary]: !_ && c === "primary",
      [n.raisedSecondary]: !_ && c === "secondary",
      [n[`size${(0, l.capitalize)(v)}`]]: v !== "medium",
      [n.disabled]: d,
      [n.fullWidth]: m
    }, a);
    let x = t;
    if (h) {
      x = i.default.Children.map(x, e => (0, u.isMuiElement)(e, ["Icon", "SvgIcon"]) ? i.default.cloneElement(e, {
        fontSize: true
      }) : e);
    }
    return i.default.createElement(s.default, r({
      innerRef: e => {
        this.buttonBase = e;
      },
      className: w,
      disabled: d,
      focusRipple: !f,
      keyboardFocusedClassName: n.keyboardFocused
    }, b), i.default.createElement("span", {
      className: n.label
    }, x));
  }
}
m.defaultProps = Object.assign({}, h.defaultProps, {
  color: "default",
  disabled: false,
  disableFocusRipple: false,
  disableRipple: false,
  fab: false,
  fullWidth: false,
  mini: false,
  raised: false,
  size: "medium",
  type: "button"
});
exports.Button = (0, a.default)(c.styles, {
  name: "MuiButton"
})(m);
class y extends h {
  render() {
    var e = this.props;
    e.pressed;
    e.pulsating;
    const t = e.children;
    const n = e.classes;
    const a = e.className;
    const c = e.color;
    const d = e.disabled;
    const f = p(e, ["pressed", "pulsating", "children", "classes", "className", "color", "disabled"]);
    return i.default.createElement(s.default, r({
      innerRef: e => {
        this.buttonBase = e;
      },
      className: (0, o.default)(n.root, {
        [n[`color${(0, l.capitalize)(c)}`]]: c !== "default",
        [n.disabled]: d
      }, a),
      centerRipple: true,
      focusRipple: true,
      disabled: d
    }, f), i.default.createElement("span", {
      className: (0, o.default)(n.label, c === "primary" && n.active)
    }, i.default.Children.map(t, e => (0, u.isMuiElement)(e, ["Icon", "SvgIcon"]) ? i.default.cloneElement(e, {
      fontSize: true
    }) : e)));
  }
}
y.defaultProps = Object.assign({}, h.defaultProps, {
  color: "default",
  disabled: false,
  disableRipple: false
});
exports.IconButton = (0, a.default)(e => {
  const t = (0, d.styles)(e);
  t.active = {
    backgroundColor: "rgba(57, 149, 253, 0.15)",
    borderRadius: "50%",
    width: 40,
    height: 40
  };
  return t;
}, {
  name: "MuiIconButton"
})(y);