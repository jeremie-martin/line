Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.render = l;
s(require("./64.js"));
var r = require("./15.js");
var i = s(require("./240.js"));
var o = require("./17.js");
var a = require("./8.js");
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function l(e, t, {
  playbackCamera: n,
  playbackFollower: r,
  playbackZoom: i,
  playbackDimensions: o,
  index: a,
  maxIndex: s,
  showViewport: l,
  showVisibleAreas: u,
  track: c
}) {
  let d = t.w;
  let f = t.h;
  let p = t.x;
  let h = t.y;
  let m = t.z;
  let y = t.r;
  let g = p * (m *= y) - (d *= y) / 2;
  let v = h * m - (f *= y) / 2;
  e.setTransform(1, 0, 0, 1, 0, 0);
  e.clearRect(0, 0, d, f);
  if (u) {
    e.fillStyle = "rgba(0,0,0,0.1)";
    e.fillRect(0, 0, d, f);
  }
  e.setTransform(m, 0, 0, m, -g, -v);
  const b = n.position;
  const _ = n.zoom;
  let w = o.width;
  let x = o.height;
  w /= _;
  x /= _;
  if (u) {
    let t = [[b.x - w / 2, b.y - x / 2, w, x]];
    if (!r.isFixed()) {
      let e = Math.min(s, r._frames.length);
      for (let n = 0; n < e; n++) {
        var E = r._frames[n];
        const e = E.camera;
        const i = E.params;
        let o = i.width;
        let a = i.height;
        let s = i.zoom;
        let l = i.offsetX;
        let u = i.offsetY;
        o /= s;
        a /= s;
        let c = 0;
        let y = 0;
        if (i.offsetX != null && i.offsetY != null) {
          c = l * o;
          y = u * a;
        }
        if (Math.abs(e.x - p) < (d / m + o) / 2 && Math.abs(e.y - h) < (f / m + a) / 2) {
          t.push([c + e.x - o / 2, y + e.y - a / 2, o, a]);
        }
      }
    }
    e.lineWidth = 2 / m;
    e.strokeStyle = "white";
    for (const n of t) {
      e.strokeRect(n[0], n[1], n[2], n[3]);
    }
    for (const n of t) {
      e.clearRect(n[0], n[1], n[2], n[3]);
    }
  }
  if (l) {
    let t;
    if (Number.isInteger(a)) {
      t = r._getRiderPosition(c, a);
    } else {
      const e = r._getRiderPosition(c, Math.floor(a));
      const n = r._getRiderPosition(c, Math.ceil(a));
      const i = a % 1;
      t = {
        x: e.x + i * (n.x - e.x),
        y: e.y + i * (n.y - e.y)
      };
    }
    e.lineWidth = 1 / m;
    e.strokeStyle = "rgba(0,0,0,0.5)";
    e.beginPath();
    const n = b.x - b.dx;
    const i = b.y - b.dy;
    e.moveTo(b.x - w / 2, b.y - x / 2);
    e.lineTo(b.x + w / 2, b.y - x / 2);
    e.lineTo(b.x + w / 2, b.y + x / 2);
    e.lineTo(b.x - w / 2, b.y + x / 2);
    e.lineTo(b.x - w / 2, b.y - x / 2);
    e.lineTo(t.x, t.y);
    e.moveTo(n - b.w / 2, i - b.h / 2);
    e.lineTo(n + b.w / 2, i - b.h / 2);
    e.lineTo(n + b.w / 2, i + b.h / 2);
    e.lineTo(n - b.w / 2, i + b.h / 2);
    e.lineTo(n - b.w / 2, i - b.h / 2);
    e.stroke();
  }
}
exports.default = (0, r.connect)((0, o.createStructuredSelector)({
  playbackDimensions: a.getPlaybackDimensions,
  playbackCamera: a.getPlaybackCamera,
  playbackFollower: e => e.camera.playbackFollower,
  playbackZoom: a.getPlaybackZoom,
  index: a.getPlayerIndex,
  maxIndex: a.getPlayerMaxIndex,
  track: a.getSimulatorTrack
}))(class extends i.default {
  shouldRerender(e) {
    return true;
  }
  renderCanvas(e, t) {
    l(e, t, this.props);
  }
});