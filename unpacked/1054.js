Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  {
    let t = i.default.getItem(h);
    if (t == null || parseInt(t) < m) {
      let t = e.subscribe(() => {
        if ((0, o.getInEditor)(e.getState())) {
          setTimeout(() => e.dispatch((0, a.openHelpSidebar)(true)), 500);
          i.default.setItem(h, m);
          t();
        }
      });
    }
    if (!i.default.getItem("ONBOARD_UNDO")) {
      const t = e.subscribe(() => {
        const n = e.getState();
        if ((0, o.getSelectedTool)(n) === u.ERASER_TOOL) {
          const r = n.command.hotkeys["triggers.undo"];
          const o = n.command.hotkeys["triggers.redo"];
          e.dispatch((0, c.showNotification)(`Press ${r} to undo and ${o} to redo.`, false));
          i.default.setItem("ONBOARD_UNDO", true);
          t();
        }
      });
    }
  }
  0;
  {
    if (!i.default.getItem("ONBOARD_NEW_TRACK")) {
      (function (e, t) {
        let n = 0;
        let r = 0;
        let i = -1;
        let a = -1;
        const s = e.subscribe(() => {
          const l = e.getState();
          let u = l.simulator.history.findIndex(e => e === l.simulator.committedEngine);
          const c = (0, o.getSimulatorTotalLineCount)(l);
          if (u !== a) {
            if (l.simulator.history.length === 1) {
              i = 0;
              a = 0;
            } else if (u > a) {
              i = u;
            } else if (i > 3 && u < i / 2) {
              t();
              s();
            }
          } else if (c !== r) {
            if (l.simulator.history.length === 1) {
              n = c;
            } else if (c > r) {
              n = c;
            } else if (n > 10 && c < n / 2) {
              t();
              s();
            }
          }
          a = u;
          r = c;
        });
      })(e, () => {
        e.dispatch((0, c.showNotification)("You can make a new track by going to the top-left menu and clicking \"New\".", false));
        i.default.setItem("ONBOARD_NEW_TRACK", true);
      });
    }
    if (!i.default.getItem("ONBOARD_GREEN_LINE")) {
      const t = e.subscribe(() => {
        const n = e.getState();
        if ((0, o.getSelectedLineType)(n) === 2) {
          e.dispatch((0, c.showNotification)("The green line is for drawing decoration. The rider does not collide with green lines.", false));
          i.default.setItem("ONBOARD_GREEN_LINE", true);
          t();
        }
      });
    }
    if (!i.default.getItem("ONBOARD_RIDER_VIEW")) {
      const t = e.subscribe(() => {
        const n = e.getState();
        if (!(0, o.getPlayerRunning)(n)) {
          const r = (0, o.getEditorCamera)(n);
          const a = (0, o.getEditorDimensions)(n);
          const s = (0, o.getPlayerIndex)(n);
          const l = (0, o.getSimulatorTrack)(n);
          const u = l.getRider(s);
          const d = Math.abs(u.position.x - r.position.x) * r.zoom;
          const f = Math.abs(u.position.y - r.position.y) * r.zoom;
          const p = d < a.width / 2 && f < a.height / 2;
          if (!p) {
            e.dispatch((0, c.showNotification)(`Press ${n.command.hotkeys["triggers.showPlaybackCamera"]} or double-click the pan button to bring the rider into view.`, false));
            i.default.setItem("ONBOARD_RIDER_VIEW", true);
            t();
          }
        }
      });
    }
    const t = t => {
      const n = e.subscribe(() => {
        if (!(0, o.getPlayerRunning)(e.getState())) {
          setTimeout(() => {
            e.dispatch((0, c.showNotification)(t, false));
          });
          n();
        }
      });
    };
    if (!i.default.getItem("ONBOARD_LINE_FLIPPED") || !i.default.getItem("ONBOARD_TOO_FAST")) {
      let n = 0;
      const r = e.subscribe(() => {
        const a = e.getState();
        const u = Math.round((0, o.getPlayerIndex)(a));
        if (u !== n) {
          n = u;
          const e = (0, o.getSimulatorTrack)(a);
          (function (e, t, n, r) {
            const i = e.engine.getFrame(t).involvedLineIds;
            const o = e.getRawRider(t).points.find(e => e.name === "BUTT");
            let a = o.pos;
            let u = o.prevPos;
            const c = new l.default(a).sub(u);
            const d = c.copy().norm().mul(-0.000001).add(u);
            const f = Math.min(a.x, d.x);
            const p = Math.min(a.y, d.y);
            const h = Math.abs(a.x - d.x);
            const m = Math.abs(a.y - d.y);
            const y = e.engine.selectCollidingLinesInRect({
              x: f,
              y: p,
              width: h,
              height: m
            });
            for (let l of y) {
              const e = i.includes(l.id);
              if (!e) {
                const e = (0, s.lineLineIntersection)(a.x, a.y, u.x, u.y, l.x1, l.y1, l.x2, l.y2);
                if (e) {
                  const e = l.norm.dot(o.vel);
                  const t = e > 0;
                  if (!t) {
                    n();
                    break;
                  }
                }
              }
              if (c.len() > g) {
                const e = l.norm.dot(c) < 0;
                if (e) {
                  continue;
                }
                const t = (0, s.lineLineIntersection)(a.x, a.y, d.x, d.y, l.x1, l.y1, l.x2, l.y2);
                if (t != null) {
                  const e = l.offset(o);
                  const t = l.perpComp(e);
                  const n = t > 0 && t < g;
                  if (!n) {
                    r();
                    break;
                  }
                }
              } else {
                ;
              }
            }
          })(e, u, () => {
            if (!i.default.getItem("ONBOARD_LINE_FLIPPED")) {
              t("If the rider is going through these lines, that's because lines are one-sided and these lines are upside-down. To draw flipped lines, hold shift while drawing.");
              i.default.setItem("ONBOARD_LINE_FLIPPED", true);
              if (i.default.getItem("ONBOARD_LINE_FLIPPED") && i.default.getItem("ONBOARD_TOO_FAST")) {
                r();
              }
            }
          }, () => {
            if (!i.default.getItem("ONBOARD_TOO_FAST")) {
              t("If the rider is going through these lines, that's because the rider is moving too fast. Draw a spaced out stack of lines to stop the rider.");
              i.default.setItem("ONBOARD_TOO_FAST", true);
              if (i.default.getItem("ONBOARD_LINE_FLIPPED") && i.default.getItem("ONBOARD_TOO_FAST")) {
                r();
              }
            }
          });
        }
      });
    }
  }
  0;
  if (!i.default.getItem("ONBOARD_TRIAL")) {
    const t = e.subscribe(() => {
      const n = e.getState();
      if (n.license.trial) {
        if ((0, o.getPlayerIndex)(n) === 1200) {
          i.default.setItem("ONBOARD_TRIAL", true);
          const n = r.default.createElement("span", null, r.default.createElement("div", null, "In trial mode, you can only create tracks that are", " ", f.TRIAL_DURATION, " seconds long."), r.default.createElement("div", null, r.default.createElement("a", {
            onClick: () => {
              (0, d.dispatchToDevice)("requestUpgrade");
              e.dispatch((0, c.hideNotification)(n));
            }
          }, "Ready to upgrade to the full version?")));
          e.dispatch((0, c.showNotification)(n, false));
          i.default.setItem(h, m);
          t();
        }
      } else {
        t();
      }
    });
  }
};
var r = p(require("./0.js"));
var i = p(require("./111.js"));
var o = require("./8.js");
var a = require("./7.js");
var s = require("./205.js");
var l = p(require("./16.js"));
var u = require("./27.js");
var c = require("./29.js");
require("./209.js");
require("./22.js");
var d = require("./26.js");
var f = require("./208.js");
function p(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const h = "EDITOR_ONBOARDED";
const m = 1;
const g = 10;
module.exports = exports.default;