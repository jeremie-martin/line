require("./421.js");
require("./472.js");
require("./475.js");
var r = v(require("./274.js"));
var i = require("./478.js");
var o = v(require("./629.js"));
var a = require("./722.js");
var s = v(require("./724.js"));
var l = v(require("./725.js"));
var u = v(require("./1048.js"));
var c = v(require("./1049.js"));
var d = v(require("./414.js"));
var f = v(require("./1050.js"));
var p = v(require("./1051.js"));
var h = require("./1052.js");
var m = v(require("./1053.js"));
var y = v(require("./1054.js"));
var g = v(require("./1055.js"));
require("./1056.js");
require("./26.js");
function v(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var b = r.default.parse(window.location.search);
let _ = b.k;
let w = b.mk;
let x = b.audio;
let E = b.track;
let S = b.offset;
let T = b.fps;
let k = b.smoothPlayback;
let O = b.hq;
let P = b.forceMillions;
let C = b.forceCanvas;
let I = b.sprite;
let M = b.precompute;
let L = (0, i.configureStore)();
(0, f.default)(L);
(0, p.default)(L);
(0, h.retrieveCommandSettings)(L);
(0, h.replaceCtrlWithCmdIfNeeded)(L);
(0, o.default)(L, {
  fps: T,
  smoothPlayback: k,
  hq: O,
  precompute: M
});
(0, a.setupRareNotifications)(L);
(0, m.default)(L);
(0, y.default)(L);
(0, g.default)(L);
(0, c.default)(L, {
  audioUrl: x,
  offset: S
});
(0, u.default)(L, {
  key: _,
  masterKey: w,
  trackUrl: E
});
if (!window.noRender) {
  (0, s.default)(L);
  (0, d.default)(L, I);
  require("./1066.js")(L, P, C);
  (0, l.default)(L, document.getElementById("content"));
}