Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./16.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
exports.default = class {
  constructor({
    id: e,
    x1: t,
    y1: n,
    x2: r,
    y2: i,
    layer: a
  }) {
    this.id = e;
    this.p1 = new o.default({
      x: t,
      y: n
    });
    this.p2 = new o.default({
      x: r,
      y: i
    });
    if (a != null) {
      this.layer = a;
    }
    this.vec = new o.default(this.p2).sub(this.p1);
    this.length = this.vec.len();
    this.norm = new o.default(this.vec).rotCW().mul(1 / this.length);
  }
  get x1() {
    return this.p1.x;
  }
  get y1() {
    return this.p1.y;
  }
  get x2() {
    return this.p2.x;
  }
  get y2() {
    return this.p2.y;
  }
  equals(e) {
    return this.id === e.id && this.type === e.type && this.p1.equals(e.p1) && this.p2.equals(e.p2);
  }
  toJSON() {
    const e = {
      id: this.id,
      type: this.type,
      x1: this.p1.x,
      y1: this.p1.y,
      x2: this.p2.x,
      y2: this.p2.y
    };
    if (this.layer) {
      e.layer = this.layer;
    }
    return e;
  }
};
module.exports = exports.default;