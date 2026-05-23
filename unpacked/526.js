Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./294.js"));
var i = o(require("./16.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const a = {
  x: 12.9898,
  y: 78.233
};
const s = 43758.5453;
function l(e) {
  return Math.sin(i.default.dot(e, a)) * s % 1;
}
const u = 2;
const c = 40;
class d extends r.default {
  static getFlutter(e, t) {
    let n = Math.pow(i.default.lenSq(e), 0.25);
    let r = l(e);
    let o = l(t);
    r *= u * n * -Math.expm1(-n / c);
    o *= Math.PI * 2;
    return {
      x: r * Math.cos(o),
      y: r * Math.sin(o)
    };
  }
  step({
    gravity: e
  }) {
    this.vel = new i.default(this.pos).sub(this.prevPos).mul(1 - this.airFriction).add(e);
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;
    this.pos.add(this.vel).add(d.getFlutter(this.vel, this.prevPos));
  }
}
exports.default = d;
module.exports = exports.default;