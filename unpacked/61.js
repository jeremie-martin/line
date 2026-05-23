Object.defineProperty(exports, "__esModule", {
  value: true
});
class r {
  constructor(e, t, n, r) {
    this.p1 = e;
    this.p2 = t;
    this.layerIndex = n;
    this.zIndex = r;
  }
  equals(e) {
    return this === e || e instanceof r && this.zIndex === e.zIndex && this.layerIndex === e.layerIndex && this.p1.x === e.p1.x && this.p1.y === e.p1.y && this.p2.x === e.p2.x && this.p2.y === e.p2.y && this.p1.thickness === e.p1.thickness && this.p2.thickness === e.p2.thickness && this.p1.colorA.equals(e.p1.colorA) && this.p2.colorA.equals(e.p2.colorA) && this.p1.colorB.equals(e.p1.colorB) && this.p2.colorB.equals(e.p2.colorB) && this.p1.cap === e.p1.cap && this.p2.cap === e.p2.cap;
  }
  boundingBox() {
    var e;
    var t;
    var n;
    var r;
    if (this.p1.x < this.p2.x) {
      e = this.p1.x;
      n = this.p2.x - this.p1.x;
    } else {
      e = this.p2.x;
      n = this.p1.x - this.p2.x;
    }
    if (this.p1.y < this.p2.y) {
      t = this.p1.y;
      r = this.p2.y - this.p1.y;
    } else {
      t = this.p2.y;
      r = this.p1.y - this.p2.y;
    }
    return {
      x: e,
      y: t,
      width: n,
      height: r
    };
  }
}
exports.default = r;
module.exports = exports.default;