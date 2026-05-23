Object.defineProperty(exports, "__esModule", {
  value: true
});
class r {
  constructor(e, t, n, r, i) {
    this.p1 = e;
    this.p2 = t;
    this.p3 = n;
    this.layerIndex = r;
    this.zIndex = i;
  }
  equals(e) {
    return this === e || e instanceof r && this.zIndex === e.zIndex && this.layerIndex === e.layerIndex && this.p1.x === e.p1.x && this.p1.y === e.p1.y && this.p2.x === e.p2.x && this.p2.y === e.p2.y && this.p3.x === e.p3.x && this.p3.y === e.p3.y && this.p1.color.equals(e.p1.color) && this.p2.color.equals(e.p2.color) && this.p3.color.equals(e.p3.color);
  }
  boundingBox() {
    var e = Math.min(this.p1.x, this.p2.x, this.p3.x);
    var t = Math.min(this.p1.y, this.p2.y, this.p3.y);
    return {
      x: e,
      y: t,
      width: Math.max(this.p1.x, this.p2.x, this.p3.x) - e,
      height: Math.max(this.p1.y, this.p2.y, this.p3.y) - t
    };
  }
}
exports.default = r;
module.exports = exports.default;