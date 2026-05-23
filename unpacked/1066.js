Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = l(require("./147.js"));
var i = l(require("./168.js"));
var o = require("./143.js");
var a = require("./365.js");
var s = require("./103.js");
function l(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const u = [/(trident).+rv[:\s]([\w\.]+).+like\sgecko/i, /(?:ms|\()(ie)\s([\w\.]+)/i, /(avant\s|iemobile|slim|baidu)(?:browser)?[\/\s]?([\w\.]*)/i];
const c = [/Mozilla\/5\.0 \(Macintosh; Intel Mac OS X 10_13_1\) AppleWebKit\/[0-9\.]+ \(KHTML, like Gecko\) Version\/[0-9\.]+ Safari\/[0-9\.]+/i, /Mozilla\/5\.0 \(Macintosh; Intel Mac OS X 10_13_0\) AppleWebKit\/[0-9\.]+ \(KHTML, like Gecko\) Version\/[0-9\.]+ Safari\/[0-9\.]+/i, /Mozilla\/5\.0 \(Macintosh; Intel Mac OS X 10_13\) AppleWebKit\/[0-9\.]+ \(KHTML, like Gecko\) Version\/[0-9\.]+ Safari\/[0-9\.]+/i];
const d = 100;
const f = d * d * 4;
const p = i.default.WebGL1Renderer;
exports.default = async function (e, t, n) {
  if (n !== undefined) {
    console.log("Forcing canvas renderer (software)");
    return;
  }
  if (!(t = t !== undefined) && u.some(e => e.test(navigator.userAgent))) {
    console.log("Using canvas renderer (software) due to problems with IE");
    return;
  }
  if (!p.isSupported()) {
    return;
  }
  if (!p.isHardwareAccelerated()) {
    if (!t) {
      console.log("Using CanvasLineDisplay (software renderer)");
      return;
    }
    console.info("Millions renderer not hardware accelerated! Using it anyway...");
  }
  let i;
  let l = document.createElement("canvas");
  let m = function () {
    let e = document.createElement("canvas");
    e.width = d;
    e.height = d;
    let t = e.getContext("2d");
    return new Promise(e => {
      let n = new Image();
      n.onload = () => {
        t.drawImage(n, 0, 0);
        e(t.getImageData(0, 0, d, d).data);
      };
      n.src = (0, r.default)("test-lines.png");
    });
  }();
  let y = null;
  try {
    y = function (e, t) {
      t.width = d;
      t.height = d;
      let n = {
        x: 0,
        y: 0,
        z: 4,
        w: d,
        h: d,
        r: 1
      };
      let r = h.map((e, t) => Object.assign({}, e, {
        id: t
      })).map(o.createFastLineFromJson);
      let i = (0, a.createInitialScenes)(r);
      (0, a.render)(e, n, i.edit);
      return e.getPixels();
    }(i = new p(l), l);
  } catch (e) {
    console.error("Error while testing MillionsLineDisplay compatibility:", e);
    console.log("Using CanvasLineDisplay (software renderer)");
    return;
  }
  let g = await m;
  let v = 0;
  for (let r = 0; r < f; r++) {
    v += Math.abs(g[r] - y[r]);
  }
  if (v > 1000000) {
    if (t) {
      console.info("Millions renderer does not render correctly! Using it anyway...");
      e.dispatch((0, s.enableMillions)());
    } else {
      console.log("Using CanvasLineDisplay (software renderer)");
    }
  } else {
    if (c.some(e => e.test(navigator.userAgent))) {
      window.glClearBroken = true;
      console.log("gl.clear() is broken on Safari with this version of macOS, using a workaround");
    }
    console.log("Using MillionsLineDisplay (hardware-accelerated renderer)");
    e.dispatch((0, s.enableMillions)());
  }
};
const h = [{
  type: 2,
  x1: -10,
  y1: -10,
  x2: 5,
  y2: 10
}, {
  type: 0,
  x1: -10,
  y1: -5,
  x2: 10,
  y2: 5,
  flipped: true
}, {
  type: 1,
  x1: -10,
  y1: 10,
  x2: 10,
  y2: -5,
  flipped: false
}];
module.exports = exports.default;