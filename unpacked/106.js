Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.keyUp = exports.keyDown = exports.wheel = exports.makeWheelArg = exports.pointerDrag = exports.pointerHover = exports.makePointerArg = exports.pointerUp = exports.pointerDown = exports.KEY_UP = exports.KEY_DOWN = exports.WHEEL = exports.POINTER_DRAG = exports.POINTER_HOVER = exports.POINTER_UP = exports.POINTER_DOWN = undefined;
var r = require("./539.js");
const i = exports.POINTER_DOWN = "POINTER_DOWN";
const o = exports.POINTER_UP = "POINTER_UP";
const a = exports.POINTER_HOVER = "POINTER_HOVER";
const s = exports.POINTER_DRAG = "POINTER_DRAG";
const l = exports.WHEEL = "WHEEL";
const u = exports.KEY_DOWN = "KEY_DOWN";
const c = exports.KEY_UP = "KEY_UP";
exports.pointerDown = ({
  pointerType: e,
  pointerId: t,
  x: n,
  y: r
}, o, a) => ({
  type: i,
  payload: {
    pointerType: e,
    isPrimary: o,
    button: a,
    id: t,
    pos: {
      x: n,
      y: r
    }
  }
});
exports.pointerUp = ({
  pointerType: e,
  pointerId: t,
  x: n,
  y: r
}, i, a) => ({
  type: o,
  payload: {
    pointerType: e,
    isPrimary: i,
    button: a,
    id: t,
    pos: {
      x: n,
      y: r
    }
  }
});
exports.makePointerArg = ({
  pointerType: e,
  pointerId: t,
  x: n,
  y: r,
  buttons: i
}) => ({
  pointerType: e,
  pointerId: t,
  x: n,
  y: r,
  buttons: i
});
exports.pointerHover = ({
  x: e,
  y: t
}) => ({
  type: a,
  payload: {
    pos: {
      x: e,
      y: t
    }
  }
});
exports.pointerDrag = ({
  pointerType: e,
  pointerId: t,
  x: n,
  y: r,
  buttons: i
}, o) => ({
  type: s,
  payload: {
    pointerType: e,
    isPrimary: o,
    buttons: i,
    id: t,
    pos: {
      x: n,
      y: r
    }
  }
});
exports.makeWheelArg = ({
  clientX: e,
  clientY: t,
  deltaX: n,
  deltaY: r,
  deltaMode: i,
  ctrlKey: o
}) => ({
  clientX: e,
  clientY: t,
  deltaX: n,
  deltaY: r,
  deltaMode: i,
  ctrlKey: o
});
exports.wheel = (e, t) => ({
  type: l,
  payload: {
    pos: {
      x: e.clientX,
      y: e.clientY
    },
    delta: {
      x: e.deltaX,
      y: e.deltaY * (t ? 1 : (0, r.normalizeDelta)(e))
    },
    pinch: e.ctrlKey
  }
});
exports.keyDown = e => ({
  type: u,
  payload: e,
  meta: {
    ignorable: true
  }
});
exports.keyUp = e => ({
  type: c,
  payload: e,
  meta: {
    ignorable: true
  }
});