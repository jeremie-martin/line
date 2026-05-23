Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.render = h;
var r = l(require("./64.js"));
var i = l(require("./61.js"));
var o = l(require("./167.js"));
var a = l(require("./240.js"));
var s = require("./81.js");
function l(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const u = 2;
const c = u / 2;
const d = "black";
const f = "white";
const p = {
  [s.SCENERY_LINE]: (0, s.getTypeInfo)(s.SCENERY_LINE).color.css,
  [s.SOLID_LINE]: (0, s.getTypeInfo)(s.SOLID_LINE).color.css,
  [s.ACC_LINE]: (0, s.getTypeInfo)(s.ACC_LINE).color.css
};
function h(e, t, n, r) {
  let a = t.w;
  let l = t.h;
  let c = t.x;
  let h = t.y;
  let v = t.z;
  let b = t.r;
  let _ = c * (v *= b) - (a *= b) / 2;
  let w = h * v - (l *= b) / 2;
  e.setTransform(1, 0, 0, 1, 0, 0);
  e.fillStyle = f;
  e.fillRect(0, 0, a, l);
  e.setTransform(v, 0, 0, v, -_, -w);
  if (n.color) {
    e.beginPath();
    for (let t of r) {
      if (t.type === s.SCENERY_LINE) {
        m(e, t);
      }
    }
    e.lineCap = "round";
    e.strokeStyle = p[s.SCENERY_LINE];
    e.lineWidth = u;
    e.stroke();
    e.beginPath();
    for (let t of r) {
      if (t.type === s.SOLID_LINE) {
        m(e, t);
      }
    }
    e.lineCap = "round";
    e.strokeStyle = p[s.SOLID_LINE];
    e.lineWidth = u;
    e.stroke();
    e.beginPath();
    for (let t of r) {
      if (t.type === s.ACC_LINE) {
        m(e, t);
      }
    }
    e.lineCap = "round";
    e.strokeStyle = p[s.ACC_LINE];
    e.lineWidth = u;
    e.stroke();
    e.beginPath();
    for (let t of r) {
      if (t.type === s.ACC_LINE) {
        y(e, t);
      }
    }
    e.fillStyle = p[s.ACC_LINE];
    e.fill();
    e.beginPath();
    for (let t of r) {
      switch (t.type) {
        case s.SOLID_LINE:
        case s.ACC_LINE:
          g(e, t);
          break;
        default:
          continue;
      }
    }
    e.fillStyle = d;
    e.fill();
  } else {
    e.beginPath();
    for (let t of r) {
      m(e, t);
    }
    e.lineCap = "round";
    e.strokeStyle = d;
    e.lineWidth = u;
    e.stroke();
  }
  if (n.toolSceneLayer) {
    e.lineCap = "round";
    for (let t of n.toolSceneLayer.entities) {
      if (t instanceof i.default) {
        let n = t.p1.colorA;
        e.beginPath();
        m(e, t);
        e.strokeStyle = `rgba(${n.r}, ${n.g}, ${n.b}, ${n.a})`;
        e.lineWidth = t.p1.thickness;
        e.stroke();
      } else if (t instanceof o.default) {
        let n = t.p1;
        let r = t.p3;
        let i = n.color;
        e.fillStyle = `rgba(${i.r}, ${i.g}, ${i.b}, ${i.a})`;
        e.fillRect(n.x, n.y, r.x - n.x, r.y - n.y);
      }
    }
  }
}
function m(e, t) {
  e.moveTo(t.p1.x, t.p1.y);
  e.lineTo(t.p2.x, t.p2.y);
}
function y(e, t) {
  let n = (0, r.default)(t.vec).norm().mul(c);
  let i = (0, r.default)(t.norm).mul(c);
  let o = Math.min(2, 1 + t.length / c);
  (function () {
    let n = arguments;
    if (t.flipped) {
      e.moveTo(n[4], n[5]);
      e.lineTo(n[2], n[3]);
      e.lineTo(n[0], n[1]);
    } else {
      e.moveTo(n[0], n[1]);
      e.lineTo(n[2], n[3]);
      e.lineTo(n[4], n[5]);
    }
  })(t.p2.x + n.x, t.p2.y + n.y, t.p2.x - n.x * 3.5 + i.x * 3, t.p2.y - n.y * 3.5 + i.y * 3, t.p2.x - o * n.x, t.p2.y - o * n.y);
}
function g(e, t) {
  let n = (0, r.default)(t.vec).norm().mul(c);
  let i = (0, r.default)(t.norm).mul(c);
  (function () {
    let n = arguments;
    if (t.flipped) {
      e.moveTo(n[10], n[11]);
      e.arcTo(n[8], n[9], n[6], n[7], c);
      e.lineTo(n[4], n[5]);
      e.arcTo(n[2], n[3], n[0], n[1], c);
    } else {
      e.moveTo(n[0], n[1]);
      e.arcTo(n[2], n[3], n[4], n[5], c);
      e.lineTo(n[6], n[7]);
      e.arcTo(n[8], n[9], n[10], n[11], c);
    }
  })(t.p1.x - n.x, t.p1.y - n.y, t.p1.x - n.x - i.x, t.p1.y - n.y - i.y, t.p1.x - i.x, t.p1.y - i.y, t.p2.x - i.x, t.p2.y - i.y, t.p2.x + n.x - i.x, t.p2.y + n.y - i.y, t.p2.x + n.x, t.p2.y + n.y);
}
exports.default = class extends a.default {
  shouldRerender(e) {
    let t = this.props.lines;
    return t !== e || t.length !== e.length;
  }
  renderCanvas(e, t) {
    h(e, t, this.props, this.props.lines);
  }
};