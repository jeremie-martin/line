Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./16.js"));
var i = a(require("./286.js"));
var o = a(require("./145.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const s = 10;
const l = 0.25;
exports.default = class extends i.default {
  constructor(e) {
    super(e);
    this.flipped = e.flipped || false;
    this.leftExtended = e.leftExtended || false;
    this.rightExtended = e.rightExtended || false;
    this.vec = new r.default(this.p2).sub(this.p1);
    this.length = this.vec.len();
    this.invLengthSq = 1 / this.vec.lenSq();
    this.norm = new r.default(this.vec).rotCW().mul((this.flipped ? -1 : 1) / this.length);
    this.extension = Math.min(l, s / this.length);
    this.leftBound = this.leftExtended ? -this.extension : 0;
    this.rightBound = this.rightExtended ? 1 + this.extension : 1;
  }
  collidesWith(e) {
    let t = this.offset(e);
    return this.shouldCollide(e, this.perpComp(t), this.linePos(t));
  }
  collide(e) {
    let t = this.offset(e);
    let n = this.perpComp(t);
    let i = this.linePos(t);
    if (this.shouldCollide(e, n, i)) {
      let t = new r.default(this.norm).mul(n).sub(e.pos).mul(-1);
      let i = new r.default(this.norm).rotCCW().mul(e.friction).mul(n);
      if (e.prevPos.x >= t.x) {
        i.x *= -1;
      }
      if (e.prevPos.y < t.y) {
        i.y *= -1;
      }
      i.add(e.prevPos);
      this.onCollide(e, t, i);
      return true;
    }
    return false;
  }
  get type() {
    return o.default.SOLID;
  }
  get collidable() {
    return true;
  }
  offset(e) {
    return new r.default(e.pos).sub(this.p1);
  }
  perpComp(e) {
    return this.norm.dot(e);
  }
  linePos(e) {
    return this.vec.dot(e) * this.invLengthSq;
  }
  shouldCollide(e, t, n) {
    let r = this.norm.dot(e.vel) > 0;
    let i = t > 0 && t < s && n >= this.leftBound && n <= this.rightBound;
    return r && i;
  }
  onCollide(e, t, n) {
    e.pos = t;
    e.prevPos = n;
  }
  equals(e) {
    return super.equals(e) && this.flipped === e.flipped && this.leftExtended === e.leftExtended && this.rightExtended === e.rightExtended;
  }
  toJSON() {
    const e = super.toJSON();
    e.flipped = this.flipped;
    e.leftExtended = this.leftExtended;
    e.rightExtended = this.rightExtended;
    if (this.multiplier != null && this.multiplier !== 1) {
      e.multiplier = this.multiplier;
    }
    return e;
  }
};
module.exports = exports.default;