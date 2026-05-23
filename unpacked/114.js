Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HOVER_CONTROL_CLASS = undefined;
exports.startForceHover = function () {
  u += 1;
  window.activationPing((0, s.ping)());
};
exports.stopForceHover = function () {
  if (u > 0) {
    u -= 1;
  }
};
var r;
var i = require("./56.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
var a = require("./8.js");
var s = require("./139.js");
const l = `.${exports.HOVER_CONTROL_CLASS = "hover-control"}:hover`;
let u = 0;
const c = {
  debounce: o.default,
  controlHovered: () => document.querySelectorAll(l).length > 0 || u > 0
};
exports.default = ({
  debounce: e,
  controlHovered: t
} = c) => ({
  dispatch: n,
  getState: r
}) => {
  let i = false;
  let o = false;
  const l = () => {
    let e = r();
    let t = (0, a.getControlsActive)(e);
    let o = i || !(0, a.getPlayerRunning)(e);
    if (t !== o) {
      n((0, s.setControlsActive)(o));
    }
  };
  const c = e(() => {
    if (!!i && (!!o || !t()) && u === 0) {
      i = false;
      l();
    }
  }, 1500, {
    leading: false,
    trailing: true
  });
  const d = () => {
    if (!i) {
      i = true;
      l();
    }
    c();
  };
  return e => function (t) {
    if (t.type === s.PING) {
      o = t.payload === "touch";
      d();
      return;
    }
    let n = r();
    let i = e(t);
    let l = r();
    if ((0, a.getPlayerRunning)(n) !== (0, a.getPlayerRunning)(l)) {
      d();
    }
    return i;
  };
};