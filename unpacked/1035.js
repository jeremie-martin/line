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
var a = require("./17.js");
var s = p(require("./2.js"));
var l = require("./8.js");
var u = require("./171.js");
var c = require("./7.js");
var d = p(require("./132.js"));
var f = function (e) {
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
}(require("./27.js"));
function p(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const h = (0, a.createStructuredSelector)({
  customSettings: l.getRegisteredSettings,
  customTools: l.getRegisteredTools,
  enabled: l.getEnabled,
  activeTool: l.getSelectedTool
});
const m = {
  toggleMod: c.toggleCustomSetting,
  setTool: c.setTool
};
class y extends i.default.PureComponent {
  constructor(e) {
    super(e);
    this.onChange = e => {
      document.activeElement.blur();
      this.props.onChange(e);
    };
  }
  render() {
    var e = this.props;
    let t = e.Component;
    let n = function (e, t) {
      var n = {};
      for (var r in e) {
        if (!(t.indexOf(r) >= 0)) {
          if (Object.prototype.hasOwnProperty.call(e, r)) {
            n[r] = e[r];
          }
        }
      }
      return n;
    }(e, ["Component"]);
    return i.default.createElement(t, r({}, n, {
      onChange: this.onChange
    }));
  }
}
exports.default = (0, o.connect)(h, m)((0, s.default)({
  root: {}
})(class extends i.default.Component {
  onToggleTool(e, t) {
    if (t && this.props.activeTool === e) {
      this.props.setTool(f.PENCIL_TOOL);
    }
    this.props.toggleMod(e);
  }
  render() {
    var e = this.props;
    let t = e.classes;
    let n = e.customSettings;
    let r = e.customTools;
    let o = e.enabled;
    let a = e.toggleMod;
    return i.default.createElement("div", {
      className: t.root
    }, i.default.createElement(d.default, {
      heading: "Custom Settings"
    }, n.map(e => i.default.createElement("div", {
      key: e.name
    }, i.default.createElement(u.FormControlLabel, {
      label: e.name,
      control: i.default.createElement(y, {
        Component: u.Switch,
        checked: o[e.name],
        onChange: () => a(e.name)
      })
    })))), i.default.createElement(d.default, {
      heading: "Custom Tools"
    }, Object.entries(r).map(([e, t]) => i.default.createElement("div", {
      key: e
    }, i.default.createElement(u.FormControlLabel, {
      label: e,
      control: i.default.createElement(y, {
        Component: u.Switch,
        checked: o[e],
        onChange: () => this.onToggleTool(e, o[e])
      })
    })))));
  }
}));
module.exports = exports.default;