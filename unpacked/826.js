Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = d(require("./0.js"));
var i = d(require("./374.js"));
var o = require("./17.js");
var a = require("./15.js");
var s = require("./34.js");
var l = require("./296.js");
var u = require("./106.js");
var c = require("./7.js");
function d(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
let f = function () {};
function p(e) {
  e.preventDefault();
}
function h(e) {
  switch (e.pointerType) {
    case "touch":
    case "pen":
      return {
        pointerType: e.pointerType,
        pointerId: e.pointerId,
        x: e.x,
        y: e.y,
        button: e.button,
        buttons: 1
      };
  }
  return e;
}
f = require("./827.js");
const m = {
  position: "absolute",
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  touchAction: "none"
};
const y = (0, o.createStructuredSelector)({
  minPressure: e => e.settings["pressure.min"],
  maxPressure: e => e.settings["pressure.max"],
  pressureEnabled: e => e.settings["pressure.enabled"]
});
const g = {
  pointerDown: u.pointerDown,
  pointerUp: u.pointerUp,
  pointerHover: u.pointerHover,
  pointerDrag: u.pointerDrag,
  wheel: u.wheel,
  selectSceneryWidth: c.selectSceneryWidth
};
exports.default = (0, a.connect)(y, g)(class extends r.default.Component {
  constructor(e) {
    super(e);
    this.pointerDrag = (0, s.rafThrottle)(this.props.pointerDrag);
    this.pointerHover = (0, s.rafThrottle)(this.props.pointerHover);
    let t = 0;
    let n = 0;
    this.wheel = (e, i) => {
      t += e.deltaX;
      n += e.deltaY;
      r(e, i);
    };
    const r = (0, s.rafThrottle)((e, r) => {
      e.deltaX = t;
      e.deltaY = n;
      this.props.wheel(e, r);
      t = 0;
      n = 0;
    });
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleMount = this.handleMount.bind(this);
    this.prevButtons = 0;
    this.downCount = 0;
    this.primaryPointerId = null;
    window.addEventListener("pointercancel", this.handlePointerUp);
  }
  handleMount(e) {
    if (e) {
      this.container = e;
      this.container.addEventListener("wheel", this.handleWheel, {
        passive: false
      });
    }
  }
  componentWillUnmount() {
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerUp);
    if (this.container) {
      this.container.removeEventListener("wheel", this.handleWheel, {
        passive: false
      });
    }
  }
  isPrimary(e) {
    return e.pointerId === this.primaryPointerId;
  }
  handleInitialPointerDown(e) {
    if (this.downCount === 0) {
      this.primaryPointerId = e.pointerId;
      window.addEventListener("pointermove", this.handlePointerMove);
      window.addEventListener("pointerup", this.handlePointerUp);
    }
    this.downCount++;
  }
  handleFinalPointerUp(e) {
    this.downCount = Math.max(0, this.downCount - 1);
    if (e.pointerId === this.primaryPointerId) {
      this.primaryPointerId = null;
    }
    if (this.downCount === 0) {
      window.removeEventListener("pointermove", this.handlePointerMove);
      window.removeEventListener("pointerup", this.handlePointerUp);
    }
  }
  handlePointerDown(e) {
    p(e);
    e = h(e);
    if (this.props.onPointerDown) {
      this.props.onPointerDown(e);
    }
    this.pointerHover.flush();
    this.handleInitialPointerDown(e);
    this.props.pointerDown(e, this.isPrimary(e), e.button);
    this.prevButtons = e.buttons;
  }
  handlePointerUp(e) {
    p(e);
    e = h(e);
    if (this.pointerDrag.flush) {
      this.pointerDrag.flush();
    }
    this.props.pointerUp(e, this.isPrimary(e), e.button);
    this.handleFinalPointerUp(e);
    this.prevButtons = e.buttons;
  }
  handlePointerMove(e) {
    if (this.props.pressureEnabled) {
      const t = (this.props.maxPressure - this.props.minPressure) * e.pressure + this.props.minPressure;
      this.props.selectSceneryWidth(t);
    }
    p(e);
    e = h(e);
    let t = this.isPrimary(e);
    if (e.buttons === this.prevButtons) {
      if (e.buttons === 0) {
        this.pointerHover((0, u.makePointerArg)(e));
      } else {
        f();
        this.pointerDrag((0, u.makePointerArg)(e), t);
      }
    } else {
      for (let n = 0; n < l.NUM_BUTTONS; n++) {
        let r = (0, l.isButtonPressed)(n, e.buttons);
        let i = (0, l.isButtonPressed)(n, this.prevButtons);
        if (!i && r) {
          this.props.pointerDown(e, t, n);
        } else if (i && !r) {
          this.props.pointerUp(e, t, n);
        }
      }
      if (e.buttons === 0) {
        this.handleFinalPointerUp(e);
      }
    }
    this.prevButtons = e.buttons;
  }
  handleWheel(e) {
    p(e);
    if (window.scroll2D == null && e.deltaX !== 0 && e.deltaY !== 0) {
      console.info("trackpad detected");
      window.scroll2D = true;
    }
    this.wheel((0, u.makeWheelArg)(e), window.scroll2D);
  }
  render() {
    return r.default.createElement(i.default, {
      style: m,
      elementRef: this.handleMount,
      onPointerDown: this.handlePointerDown,
      onPointerMove: this.handlePointerMove,
      onContextMenu: p
    }, this.props.children);
  }
});
module.exports = exports.default;