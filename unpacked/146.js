Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Tools = undefined;
var r = require("./106.js");
var i = require("./8.js");
var o = require("./296.js");
var a = require("./39.js");
var s = require("./7.js");
let l = exports.Tools = {};
exports.default = () => e => {
  let t;
  let n;
  let u;
  const c = () => {
    t = new l[(0, i.getSelectedTool)(e.getState())](e);
  };
  c();
  return l => function (d) {
    let f = d.type;
    let p = d.payload;
    switch (f) {
      case a.TRIGGER_COMMAND:
        return t.onTrigger(d.payload, () => l(d));
      case a.BEGIN_MODIFIER_COMMAND:
        if (p === "modifiers.zoom") {
          var h = d.meta.event;
          const e = h.x;
          const n = h.y;
          t.zoomStart({
            pos: {
              x: e,
              y: n
            }
          });
          const r = ({
            y: e
          }) => {
            t.zoomDrag({
              pos: {
                y: e
              }
            }, true);
          };
          const i = () => {
            t.zoomEnd();
            window.removeEventListener("pointermove", r);
            window.removeEventListener("pointerup", i);
            window.removeEventListener("pointercancel", i);
          };
          window.addEventListener("pointermove", r);
          window.addEventListener("pointerup", i);
          window.addEventListener("pointercancel", i);
          return l(d);
        }
      case a.END_MODIFIER_COMMAND:
        switch (p) {
          case "modifiers.undo":
          case "modifiers.redo":
            clearInterval(u);
            if (f === a.BEGIN_MODIFIER_COMMAND) {
              let t = p === "modifiers.undo" ? s.undoAction : s.redoAction;
              e.dispatch(t());
              u = setTimeout(() => {
                u = setInterval(() => {
                  e.dispatch(t());
                }, 100);
              }, 500);
            }
        }
        let i = l(d);
        if (n) {
          e.dispatch(n);
        }
        return i;
      case r.KEY_DOWN:
      case r.KEY_UP:
        return l(d);
      case r.WHEEL:
        t.onWheel(p);
        return;
      case r.POINTER_HOVER:
        n = d;
        t.onHover(p);
        return;
      case r.POINTER_DOWN:
        if (p.isPrimary) {
          switch (p.button) {
            case o.Button.LEFT:
              t.onPointerDown(p);
              break;
            case o.Button.MIDDLE:
              t.onMiddleButtonDown(p);
              break;
            case o.Button.RIGHT:
              t.onRightButtonDown(p);
          }
        }
        if (p.pointerType === "touch") {
          t.onMultiTouchDown(p);
        }
        return;
      case r.POINTER_UP:
        if (p.isPrimary) {
          switch (p.button) {
            case o.Button.LEFT:
              t.onPointerUp(p);
              break;
            case o.Button.MIDDLE:
              t.onMiddleButtonUp(p);
              break;
            case o.Button.RIGHT:
              t.onRightButtonUp(p);
          }
        }
        if (p.pointerType === "touch") {
          t.onMultiTouchUp(p);
        }
        return;
      case r.POINTER_DRAG:
        n = d;
        if (p.isPrimary) {
          if ((0, o.isButtonPressed)(o.Button.LEFT, p.buttons)) {
            t.onPointerDrag(p);
          }
          if ((0, o.isButtonPressed)(o.Button.MIDDLE, p.buttons)) {
            t.onMiddleButtonDrag(p);
          }
          if ((0, o.isButtonPressed)(o.Button.RIGHT, p.buttons)) {
            t.onRightButtonDrag(p);
          }
        }
        if (p.pointerType === "touch") {
          t.onMultiTouchDrag(p);
        }
        return;
    }
    let m = e.getState();
    let y = l(d);
    let g = e.getState();
    if ((0, i.getSelectedTool)(m) !== (0, i.getSelectedTool)(g)) {
      t.onPointerUp();
      c();
    }
    if ((0, i.getPlayerRunning)(m) !== (0, i.getPlayerRunning)(g)) {
      t.onPlaybackStateChange((0, i.getPlayerRunning)(g));
    }
    return y;
  };
};