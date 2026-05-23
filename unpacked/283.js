Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./64.js"));
var i = a(require("./284.js"));
var o = a(require("./144.js"));
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
    this.c = this.getComputed();
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
      let t = (0, r.default)(this.c.norm).mul(n).sub(e.pos).mul(-1);
      let i = (0, r.default)(this.c.norm).rotCCW().mul(e.friction).mul(n);
      if (e.prevPos.x >= t.x) {
        i.x *= -1;
      }
      if (e.prevPos.y < t.y) {
        i.y *= -1;
      }
      i.add(e.prevPos);
      return this.doCollide(e, t, i);
    }
    return null;
  }
  get type() {
    return o.default.SOLID;
  }
  get collidable() {
    return true;
  }
  get extension() {
    return Math.min(l, s / this.length);
  }
  get leftBound() {
    if (this.leftExtended) {
      return -this.extension;
    } else {
      return 0;
    }
  }
  get rightBound() {
    if (this.rightExtended) {
      return 1 + this.extension;
    } else {
      return 1;
    }
  }
  getComputed() {
    return {
      vec: this.vec,
      norm: this.norm,
      invLengthSq: this.invLengthSq,
      length: this.length,
      extension: this.extension,
      leftBound: this.leftBound,
      rightBound: this.rightBound
    };
  }
  offset(e) {
    return (0, r.default)(e.pos).sub(this.p1);
  }
  perpComp(e) {
    return this.c.norm.dot(e);
  }
  linePos(e) {
    return this.c.vec.dot(e) * this.c.invLengthSq;
  }
  shouldCollide(e, t, n) {
    let r = this.c.norm.dot(e.vel) > 0;
    let i = t > 0 && t < s && n >= this.c.leftBound && n <= this.c.rightBound;
    return r && i;
  }
  doCollide(e, t, n) {
    return e.updateState({
      pos: t,
      prevPos: n
    });
  }
  equals(e) {
    return super.equals(e) && this.flipped === e.flipped && this.leftExtended === e.leftExtended && this.rightExtended === e.rightExtended;
  }
  toJSON() {
    let e = this.flipped;
    let t = this.leftExtended;
    let n = this.rightExtended;
    return Object.assign(super.toJSON(), {
      flipped: e,
      leftExtended: t,
      rightExtended: n
    });
  }
};
module.exports = exports.default;