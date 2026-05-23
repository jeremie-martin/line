Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = l(require("./0.js"));
var i = l(require("./374.js"));
var o = require("./15.js");
var a = require("./7.js");
var s = require("./114.js");
function l(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const u = {
  position: "fixed",
  left: "-5000px",
  top: "-5000px",
  right: "-5000px",
  bottom: "-5000px",
  zIndex: 9999
};
exports.default = (0, o.connect)((e, {
  modifier: t
}) => ({}), {
  setPlayerScrubbing: a.setPlayerScrubbing
})(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    this.state = {
      pointerId: null
    };
    this.onElemRef = e => this.elem = e;
    this.elem = null;
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
  }
  componentDidMount() {
    this.elem.addEventListener("pointerdown", this.onPointerDown);
  }
  componentWillUnmount() {
    this.elem.removeEventListener("pointerdown", this.onPointerDown);
    this.removeTempListeners();
  }
  addTempListeners() {
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
  }
  removeTempListeners() {
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
  }
  onPointerDown(e) {
    if (this.state.pointerId != null) {
      return;
    }
    if (this.props.onBeginScrubbing) {
      this.props.onBeginScrubbing();
    }
    this.props.setPlayerScrubbing(true);
    this.setState({
      pointerId: e.pointerId
    });
    this.addTempListeners();
    (0, s.startForceHover)();
    const t = this.props.getTimelineClientRect();
    this.timelineRect = t;
    const n = t.left + (t.right - t.left) * (this.props.percent / 100);
    this.offsetX = e.clientX - n;
    if (this.props.clickToSeek === true) {
      this.offsetX = 0;
      this.onPointerMove(e);
    }
  }
  onPointerMove(e) {
    if (e.pointerId !== this.state.pointerId) {
      return;
    }
    const t = this.props.getTimelineClientRect() || this.timelineRect;
    let n = (e.clientX - this.offsetX - t.left) / (t.right - t.left) * 100;
    if (this.props.overScrub) {
      const e = 105;
      if ((n = Math.max(0, n)) > e) {
        const t = (n - e) * 2;
        const r = 100 + Math.pow(t, 2) * 2;
        this.props.onPercentChanged(n, r);
      } else {
        n = Math.min(100, n);
        this.props.onPercentChanged(n, n);
      }
    } else {
      this.props.onPercentChanged(Math.max(Math.min(100, n), 0));
    }
  }
  onPointerUp(e) {
    if (e.pointerId === this.state.pointerId) {
      if (this.props.onEndScrubbing) {
        this.props.onEndScrubbing();
      }
      this.props.setPlayerScrubbing(false);
      this.setState({
        pointerId: null
      });
      this.removeTempListeners();
      this.offsetX = null;
      (0, s.stopForceHover)();
    }
  }
  render() {
    const e = r.default.Children.only(this.props.children);
    if (typeof e.type != "string" && !(e.type instanceof String)) {
      throw new Error("child must be native component, not a class/function");
    }
    let t = Object.assign({}, e.props.style, {
      touchAction: "none"
    });
    if (this.props.percent != null) {
      t.left = `${this.props.percent}%`;
    }
    const n = r.default.cloneElement(e, {
      ref: this.onElemRef,
      "touch-action": "none",
      style: t
    });
    let o = null;
    if (this.state.pointerId != null) {
      o = r.default.createElement(i.default, {
        style: u,
        onPointerMove: this.onPointerMove,
        onPointerUp: this.onPointerUp
      });
    }
    return r.default.createElement(r.default.Fragment, null, n, o);
  }
});
module.exports = exports.default;