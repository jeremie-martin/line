Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./104.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
exports.default = class extends o.default {
  constructor(e, t, n) {
    super(e, t, n);
    this.riderMounted = e.riderMounted;
    this.sledIntact = e.sledIntact;
    this.framesSinceUnmount = e.framesSinceUnmount;
    this.framesSinceSledBreak = e.framesSinceSledBreak;
  }
  getSnapshot() {
    const e = super.getSnapshot();
    e.riderMounted = this.riderMounted;
    e.sledIntact = this.sledIntact;
    e.framesSinceUnmount = this.framesSinceUnmount;
    e.framesSinceSledBreak = this.framesSinceSledBreak;
    e.framesSinceStringDetached = this.framesSinceStringDetached;
    return e;
  }
  step(e, t) {
    super.step(e, t);
    if (this.riderMounted) {
      this.framesSinceUnmount = -1;
    } else {
      ++this.framesSinceUnmount;
    }
    if (this.sledIntact) {
      this.framesSinceSledBreak = -1;
    } else {
      ++this.framesSinceSledBreak;
    }
  }
  endStep(e) {
    super.endStep(e);
    if (!this.riderMounted && this.framesSinceUnmount < 0) {
      this.framesSinceUnmount = 0;
    }
    if (!this.sledIntact && this.framesSinceSledBreak < 0) {
      this.framesSinceSledBreak = 0;
    }
  }
  get framesSinceStringDetached() {
    return this.framesSinceUnmount;
  }
};
module.exports = exports.default;