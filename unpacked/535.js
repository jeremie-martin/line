Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = s(require("./65.js"));
var i = s(require("./16.js"));
var o = require("./83.js");
var a = require("./105.js");
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = class extends r.default {
  constructor(e, t, n) {
    super(e, t, n);
    this.computedEndurance = e.computedEndurance;
    if (this.computedEndurance == null) {
      this.computedEndurance = e.endurance * this.length * 0.5;
    }
    this.computedRemountEndurance = e.computedRemountEndurance;
    if (this.computedRemountEndurance == null) {
      this.computedRemountEndurance = e.remountEndurance * this.length * 0.5;
    }
    this.remountStrength = e.remountStrength ?? 1;
  }
  resolve() {
    switch (this.entity.riderState) {
      case a.RiderState.DISMOUNTING:
      case a.RiderState.DISMOUNTED:
        return;
    }
    let e = i.default.dist(this.p1.pos, this.p2.pos);
    if (this.shouldDismount(e)) {
      this.entity.riderState = this.entity.riderState === a.RiderState.MOUNTED ? a.RiderState.DISMOUNTING : a.RiderState.DISMOUNTED;
      this.entity.frameCounter = -1;
    } else {
      const t = this.entity.riderState === a.RiderState.MOUNTED ? this.strength : this.remountStrength;
      super.resolve(e, t);
    }
  }
  shouldDismount(e = i.default.dist(this.p1.pos, this.p2.pos), t = this.entity.riderState) {
    return (0, o.getDiff)(this.length, e) * 0.5 > (t === a.RiderState.MOUNTED ? this.computedEndurance : this.computedRemountEndurance);
  }
  getSnapshot() {
    return Object.assign({}, super.getSnapshot(), {
      computedEndurance: this.computedEndurance,
      computedRemountEndurance: this.computedRemountEndurance,
      remountStrength: this.remountStrength
    });
  }
  getStrain() {
    switch (this.entity.riderState) {
      case a.RiderState.DISMOUNTING:
      case a.RiderState.DISMOUNTED:
        return 0;
    }
    const e = this.entity.riderState === a.RiderState.MOUNTED ? this.strength : this.remountStrength;
    let t = i.default.dist(this.p1.pos, this.p2.pos);
    return Math.abs(t - this.length) * e;
  }
};
module.exports = exports.default;