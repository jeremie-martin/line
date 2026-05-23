Object.defineProperty(exports, "__esModule", {
  value: true
});
class r {
  static len(e) {
    return Math.sqrt(e.x * e.x + e.y * e.y);
  }
  static lenSq(e) {
    return e.x * e.x + e.y * e.y;
  }
  static angle(e) {
    return Math.atan2(e.y, e.x);
  }
  static angleTo(e, t) {
    return Math.atan2(t.cross(e), t.dot(e));
  }
  static dist(e, t) {
    const n = t.x - e.x;
    const r = t.y - e.y;
    return Math.sqrt(n * n + r * r);
  }
  static distSq(e, t) {
    const n = t.x - e.x;
    const r = t.y - e.y;
    return n * n + r * r;
  }
  static dot(e, t) {
    return e.x * t.x + e.y * t.y;
  }
  static cross(e, t) {
    return e.x * t.y - e.y * t.x;
  }
  static equals(e, t) {
    return e.x === t.x && e.y === t.y;
  }
  static from(e, t) {
    return new r({
      x: e,
      y: t
    });
  }
  constructor(e) {
    this.x = e.x;
    this.y = e.y;
  }
  set(e) {
    this.x = e.x;
    this.y = e.y;
    return this;
  }
  copy() {
    return new r(this);
  }
  copyAsObject() {
    return {
      x: this.x,
      y: this.y
    };
  }
  add(e) {
    this.x += e.x;
    this.y += e.y;
    return this;
  }
  sub(e) {
    this.x -= e.x;
    this.y -= e.y;
    return this;
  }
  mul(e) {
    this.x *= e;
    this.y *= e;
    return this;
  }
  div(e) {
    this.x /= e;
    this.y /= e;
    return this;
  }
  norm() {
    this.div(this.len());
    return this;
  }
  transform([e, t, n, r, i, o]) {
    const a = this.x;
    const s = this.y;
    this.x = e * a + n * s + i;
    this.y = t * a + r * s + o;
    return this;
  }
  rot(e) {
    const t = Math.cos(e);
    const n = Math.sin(e);
    const r = this.x;
    const i = this.y;
    this.x = r * t - i * n;
    this.y = r * n + i * t;
    return this;
  }
  rotateAbout(e, t) {
    return this.sub(e).rot(t).add(e);
  }
  scaleAbout(e, t) {
    return this.sub(e).mul(t).add(e);
  }
  rotCW() {
    const e = this.x;
    const t = this.y;
    this.x = -t;
    this.y = e;
    return this;
  }
  rotCCW() {
    const e = this.x;
    const t = this.y;
    this.x = t;
    this.y = -e;
    return this;
  }
  len() {
    return r.len(this);
  }
  lenSq() {
    return r.lenSq(this);
  }
  angle() {
    return r.angle(this);
  }
  angleTo(e) {
    return r.angleTo(this, e);
  }
  dist(e) {
    return r.dist(this, e);
  }
  distSq(e) {
    return r.distSq(this, e);
  }
  dot(e) {
    return r.dot(this, e);
  }
  cross(e) {
    return r.cross(this, e);
  }
  equals(e) {
    return r.equals(this, e);
  }
}
exports.default = r;
module.exports = exports.default;