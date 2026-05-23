Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = function () {
  return function (e, t) {
    if (Array.isArray(e)) {
      return e;
    }
    if (Symbol.iterator in Object(e)) {
      return function (e, t) {
        var n = [];
        var r = true;
        var i = false;
        var o = undefined;
        try {
          for (var a, s = e[Symbol.iterator](); !(r = (a = s.next()).done) && (n.push(a.value), !t || n.length !== t); r = true);
        } catch (e) {
          i = true;
          o = e;
        } finally {
          try {
            if (!r && s.return) {
              s.return();
            }
          } finally {
            if (i) {
              throw o;
            }
          }
        }
        return n;
      }(e, t);
    }
    throw new TypeError("Invalid attempt to destructure non-iterable instance");
  };
}();
exports.getPhysicsStats = h;
var i = c(require("./0.js"));
var o = c(require("./68.js"));
var a = require("./15.js");
var s = require("./17.js");
var l = require("./8.js");
var u = c(require("./16.js"));
function c(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const d = (0, s.createStructuredSelector)({
  index: l.getPlayerIndex,
  track: l.getSimulatorTrack,
  numRiders: l.getNumRiders
});
const f = ["BUTT", "SHOULDER", "RHAND", "LHAND", "LFOOT", "RFOOT"];
function p(e) {
  let t = 0;
  let n = 0;
  e.forEach(e => {
    t += e.x;
    n += e.y;
  });
  return new u.default({
    x: t / e.length,
    y: n / e.length
  });
}
function h(e, t, n, r = false) {
  t = Math.floor(t);
  const i = e.getRawRiders(t)[n];
  const o = e.getRawRiders(Math.max(0, t - 1))[n];
  const a = i.points.filter(e => e.type === "CollisionPoint");
  const s = o.points.filter(e => e.type === "CollisionPoint");
  let l = a.filter(e => f.indexOf(e.name) >= 0);
  let c = s.filter(e => f.indexOf(e.name) >= 0);
  let d = p(l.map(e => e.pos));
  let h = p(c.map(e => e.pos));
  let m = p(a.map(e => e.pos));
  let y = p(s.map(e => e.pos));
  let g = d.copy().sub(h);
  let v = a.map(({
    pos: e
  }, t) => {
    const n = new u.default(e).sub(m);
    const r = new u.default(s[t].pos).sub(y);
    return n.angleTo(r);
  }).reduce((e, t) => e + t, 0) / a.length;
  let b = i.constraints.reduce((e, t) => t.strain != null ? e + t.strain : e, 0);
  let _ = "MOUNTED";
  if (i.riderMounted === false) {
    _ = "DISMOUNTED";
  }
  if (i.riderState) {
    _ = i.riderState;
    if (r && _ !== "MOUNTED") {
      _ = i.frameCounter + " " + _;
    }
  }
  return [_, g.len(), -Math.atan2(g.y, g.x) * 180 / Math.PI, -v * 180 / Math.PI, b];
}
exports.default = (0, a.connect)(d)(class extends i.default.PureComponent {
  renderStats(e) {
    var t = h(this.props.track, this.props.index, e, true);
    var n = r(t, 5);
    const o = n[0];
    const a = n[1];
    const s = n[2];
    const l = n[3];
    const u = n[4];
    return i.default.createElement("div", {
      key: e,
      style: {
        margin: 4
      }
    }, "#", e + 1, i.default.createElement("br", null), o, i.default.createElement("br", null), a.toFixed(3), " p/f", i.default.createElement("br", null), s.toFixed(2), "˚", i.default.createElement("br", null), l.toFixed(2), "˚/f", i.default.createElement("br", null), u.toFixed(3), " p");
  }
  render() {
    return i.default.createElement(o.default, {
      anchor: "bottomRight",
      align: "top",
      style: {
        fontFamily: "monospace",
        textAlign: "right",
        whiteSpace: "nowrap"
      },
      vertical: true
    }, Array(this.props.numRiders).fill().map((e, t) => this.renderStats(t)));
  }
});