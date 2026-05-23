Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.replaceCtrlWithCmdIfNeeded = function (e) {
  if (/Mac|iPod|iPhone|iPad/.test(navigator.platform)) {
    e.dispatch((0, a.replaceCtrlKey)("cmd"));
  }
};
exports.retrieveCommandSettings = function (e) {
  let t;
  let n = o.default.getItem(s);
  if (n) {
    e.dispatch((0, a.initCommandHotkeys)(JSON.parse(n)));
  }
  e.subscribe(() => {
    const n = e.getState().command.hotkeys;
    if (n !== t) {
      o.default.setItem(s, JSON.stringify(n));
      t = n;
    }
  });
};
var r;
var i = require("./111.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
var a = require("./39.js");
const s = "HOTKEYS";