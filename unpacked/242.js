Object.defineProperty(exports, "__esModule", {
  value: true
});
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
var i = p(require("./0.js"));
var o = require("./15.js");
var a = p(require("./849.js"));
var s = require("./39.js");
var l = p(require("./850.js"));
var u = require("./74.js");
var c = p(u);
var d = require("./38.js");
var f = require("./171.js");
function p(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const h = (e, {
  action: t,
  trigger: n
}) => t ? () => {
  let n = t();
  if (n) {
    e(n);
  }
} : n ? () => e((0, s.triggerCommand)(n)) : null;
const m = {
  style: {
    maxHeight: 312
  }
};
exports.default = (0, o.connect)((e, {
  selected: t = false,
  disabled: n = false,
  tooltip: r = false
}) => ({
  selected: t && t(e),
  disabled: n && n(e),
  tooltip: r && r(e)
}), (e, t) => ({
  dispatch: e,
  onClick: h(e, t),
  beginModifierCommand: (t, n) => e((0, s.beginModifierCommand)(t, n)),
  endModifierCommand: t => e((0, s.endModifierCommand)(t))
}))(class extends i.default.Component {
  constructor(e) {
    super(e);
    this.state = {};
    this.state = {
      anchorEl: null,
      selected: null
    };
    this.handleClick = e => {
      this.setState({
        anchorEl: e.currentTarget
      });
    };
    this.handleClose = () => {
      this.setState({
        anchorEl: null,
        selected: null
      });
    };
    if (e.id === "main-menu-button") {
      this.onboardMenu = e => {
        const t = document.getElementById("main-menu-button");
        if (t) {
          t.click();
          this.openTimer = setTimeout(() => {
            this.setState({
              selected: e.selected
            });
          }, 300);
        }
      };
      window.addEventListener("onboardmenu", this.onboardMenu);
    }
  }
  componentWillUnmount() {
    if (this.props.id === "main-menu-button") {
      clearTimeout(this.openTimer);
      window.removeEventListener("onboardmenu", this.onboardMenu);
    }
  }
  render() {
    var e = this.props;
    let t = e.dispatch;
    let n = e.Icon;
    let o = e.selected;
    let s = e.disabled;
    let p = e.trigger;
    let y = e.modifier;
    let g = e.menu;
    let v = e.onClick;
    e.action;
    let b = e.beginModifierCommand;
    let _ = e.endModifierCommand;
    let w = e.tooltip;
    let x = function (e, t) {
      var n = {};
      for (var r in e) {
        if (!(t.indexOf(r) >= 0)) {
          if (Object.prototype.hasOwnProperty.call(e, r)) {
            n[r] = e[r];
          }
        }
      }
      return n;
    }(e, ["dispatch", "Icon", "selected", "disabled", "trigger", "modifier", "menu", "onClick", "action", "beginModifierCommand", "endModifierCommand", "tooltip"]);
    if (y) {
      return i.default.createElement(l.default, r({}, x, {
        Button: n.Button,
        modifier: y,
        disabled: s,
        onBegin: b,
        onEnd: _
      }));
    } else if (p) {
      return i.default.createElement(a.default, r({}, x, {
        Button: n.Button,
        trigger: p,
        disabled: s,
        selected: o,
        onSelect: v
      }));
    } else if (g) {
      return i.default.createElement("div", null, i.default.createElement(n.Button, r({}, x, {
        disabled: s,
        onClick: this.handleClick
      })), i.default.createElement(c.default, {
        anchorEl: this.state.anchorEl,
        open: Boolean(this.state.anchorEl),
        onClose: this.handleClose,
        PaperProps: m
      }, g.map((e, n) => i.default.createElement(u.MenuItem, {
        key: n,
        selected: this.state.selected === e.name,
        onClick: () => {
          h(t, e)();
          this.handleClose();
        }
      }, i.default.createElement(e.Icon.Button, {
        color: e.color,
        pulsating: e.pulsating
      }), i.default.createElement(d.ListItemText, {
        primary: e.name
      })))));
    } else if (w) {
      return i.default.createElement(f.Tooltip, {
        open: true,
        title: w,
        placement: "left",
        style: {
          whiteSpace: "nowrap"
        }
      }, i.default.createElement(n.Button, r({}, x, {
        disabled: s,
        color: o ? "primary" : "",
        onClick: v
      })));
    } else {
      return i.default.createElement(n.Button, r({}, x, {
        disabled: s,
        color: o ? "primary" : "",
        onClick: v
      }));
    }
  }
});
module.exports = exports.default;