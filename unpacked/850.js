Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = Object.assign || function (e) {
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
var o = require("./0.js");
var a = (r = o) && r.__esModule ? r : {
  default: r
};
var s = require("./15.js");
var l = require("./35.js");
var u = require("./114.js");
exports.default = (0, s.connect)((e, {
  modifier: t
}) => ({
  active: (0, l.getModifier)(e, t)
}))(class extends a.default.PureComponent {
  constructor(e) {
    super(e);
    this.button = null;
    this.pointerId = null;
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
  }
  componentDidMount() {
    this.button.addEventListener("pointerdown", this.onPointerDown);
  }
  componentWillUnmount() {
    this.button.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
  }
  onPointerDown(e) {
    if (this.pointerId == null) {
      this.pointerId = e.pointerId;
      this.props.onBegin(this.props.modifier, e);
      (0, u.startForceHover)();
      window.addEventListener("pointerup", this.onPointerUp);
      window.addEventListener("pointercancel", this.onPointerUp);
    }
  }
  onPointerUp(e) {
    if (e.pointerId === this.pointerId) {
      this.pointerId = null;
      this.props.onEnd(this.props.modifier);
      (0, u.stopForceHover)();
      window.removeEventListener("pointerup", this.onPointerUp);
      window.removeEventListener("pointercancel", this.onPointerUp);
    }
  }
  render() {
    var e = this.props;
    let t = e.disabled;
    let n = e.active;
    let r = e.Button;
    e.onBegin;
    e.onEnd;
    e.dispatch;
    let o = function (e, t) {
      var n = {};
      for (var r in e) {
        if (!(t.indexOf(r) >= 0)) {
          if (Object.prototype.hasOwnProperty.call(e, r)) {
            n[r] = e[r];
          }
        }
      }
      return n;
    }(e, ["disabled", "active", "Button", "onBegin", "onEnd", "dispatch"]);
    return a.default.createElement("span", {
      ref: e => this.button = e,
      "touch-action": "none",
      style: {
        touchAction: "none"
      }
    }, a.default.createElement(r, i({}, o, {
      disabled: t,
      pressed: n,
      color: n ? "primary" : ""
    })));
  }
});
module.exports = exports.default;