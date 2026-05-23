Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./16.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
exports.default = class {
  constructor(e, t) {
    this.previousValue = e;
    this.targetValue = e;
    this.changeTime = Date.now();
    this.periodMs = t;
  }
  setValue(e) {
    if (e !== this.targetValue) {
      this.previousValue = this.getInterpolatedValue();
      this.targetValue = e;
      this.changeTime = Date.now();
    }
  }
  getInterpolatedValue() {
    if (this.previousValue === this.targetValue) {
      return this.targetValue;
    }
    let e = Date.now() - this.changeTime;
    if (e >= this.periodMs) {
      this.previousValue = this.targetValue;
      return this.targetValue;
    }
    let t = e / this.periodMs;
    return new o.default({
      x: this.previousValue.x + (this.targetValue.x - this.previousValue.x) * t,
      y: this.previousValue.y + (this.targetValue.y - this.previousValue.y) * t
    });
  }
};
module.exports = exports.default;