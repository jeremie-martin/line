Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./64.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
exports.default = class {
  constructor({
    id: e,
    x1: t,
    y1: n,
    x2: r,
    y2: i
  }) {
    this.id = e;
    this.p1 = (0, o.default)({
      x: t,
      y: n
    });
    this.p2 = (0, o.default)({
      x: r,
      y: i
    });
  }
  get collidable() {
    return false;
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
  get vec() {
    return (0, o.default)(this.p2).sub(this.p1);
  }
  get lengthSq() {
    return this.vec.lenSq();
  }
  get invLengthSq() {
    return 1 / this.lengthSq;
  }
  get length() {
    return Math.sqrt(this.lengthSq);
  }
  get invLength() {
    return 1 / this.length;
  }
  get norm() {
    return (0, o.default)(this.vec).rotCW().mul(this.invLength * (this.flipped ? -1 : 1));
  }
  equals(e) {
    return this.id === e.id && this.type === e.type && this.p1.equals(e.p1) && this.p2.equals(e.p2);
  }
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      x1: this.p1.x,
      y1: this.p1.y,
      x2: this.p2.x,
      y2: this.p2.y
    };
  }
};
module.exports = exports.default;