Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./203.js"));
var i = a(require("./16.js"));
var o = require("./83.js");
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
class s extends r.default {
  constructor(e, t, n) {
    super(e, t, n);
    this.p1 = t.getPoint(e.p1);
    this.p2 = t.getPoint(e.p2);
    let r = e.length;
    if (r == null) {
      r = i.default.dist(this.p1.pos, this.p2.pos);
      let t = 1;
      if (e.lengthFactor) {
        t = e.lengthFactor;
      }
      r *= t;
    }
    this.length = r;
    this.bias = e.bias ?? 0.5;
    this.strength = e.strength ?? 1;
  }
  getSnapshot() {
    return {
      type: this.type,
      name: this.name,
      p1: this.p1.name,
      p2: this.p2.name,
      length: this.length,
      bias: this.bias,
      strength: this.strength,
      strain: this.getStrain()
    };
  }
  resolve(e = i.default.dist(this.p1.pos, this.p2.pos), t = this.strength) {
    let n = new i.default(this.p1.pos).sub(this.p2.pos);
    let r = (0, o.getDiff)(this.length, e) * t;
    let a = new i.default(n).mul(r * this.bias);
    let s = new i.default(n).mul(r * (1 - this.bias));
    this.p1.pos.sub(a);
    this.p2.pos.add(s);
  }
  getStrain() {
    let e = i.default.dist(this.p1.pos, this.p2.pos);
    return Math.abs(e - this.length) * this.strength;
  }
}
exports.default = s;
s.iterating = true;
module.exports = exports.default;