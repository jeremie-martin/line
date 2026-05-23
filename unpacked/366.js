Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./367.js");
const i = 0.7071066656;
class o {
  constructor(e, t, n, r, i, o) {
    this.center = e;
    this.radialPoint = t;
    this.arcAngle = n;
    this.color = r;
    this.layerIndex = i;
    this.zIndex = o;
    const a = this.radialPoint.x - this.center.x;
    const s = this.radialPoint.y - this.center.y;
    this.radius = Math.sqrt(a * a + s * s);
  }
  getClippingTriangle() {
    const e = (this.radialPoint.x - this.center.x) * Math.SQRT2;
    const t = (this.radialPoint.y - this.center.y) * Math.SQRT2;
    const n = this.center.x + e;
    const o = this.center.y + t;
    const a = Math.sqrt(e * e + t * t);
    const s = Math.PI - (Math.PI / 4 + this.arcAngle);
    const l = a / Math.sin(s) * i;
    let u = (0, r.rotateAboutOrigin)({
      x: e,
      y: t
    }, this.arcAngle);
    let c = l / a;
    let d = this.center.x + u.x * c;
    let f = this.center.y + u.y * c;
    return {
      center: this.center,
      primary: {
        x: n,
        y: o
      },
      secondary: {
        x: d,
        y: f
      }
    };
  }
  equals(e) {
    return this === e || e instanceof o && this.zIndex === e.zIndex && this.layerIndex === e.layerIndex && this.center.x === e.center.x && this.center.y === e.center.y && this.radialPoint.x === e.radialPoint.x && this.radialPoint.y === e.radialPoint.y && this.arcAngle === e.arcAngle && this.color.equals(e.color);
  }
  boundingBox() {
    let e = this._getClippingTriangle();
    let t = {
      x: e.center.x,
      y: e.center.y,
      width: 0,
      height: 0
    };
    (0, r.fitBoundingBoxToPoint)(t, e.primary);
    (0, r.fitBoundingBoxToPoint)(t, e.secondary);
    return t;
  }
}
exports.default = o;
module.exports = exports.default;