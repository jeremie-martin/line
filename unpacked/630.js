Object.defineProperty(exports, "__esModule", {
  value: true
});
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
    return this.previousValue + (this.targetValue - this.previousValue) * t;
  }
};
module.exports = exports.default;