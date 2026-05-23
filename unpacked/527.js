Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./65.js"));
var i = a(require("./16.js"));
var o = require("./83.js");
function a(e) {
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
    let r = e.computedEndurance;
    if (r == null) {
      r = e.endurance * this.length * 0.5;
    }
    this.computedEndurance = r;
  }
  resolve() {
    if (!this.entity.riderMounted) {
      return;
    }
    let e = i.default.dist(this.p1.pos, this.p2.pos);
    if (this.shouldDismount(e)) {
      this.entity.riderMounted = false;
    } else {
      super.resolve(e);
    }
  }
  shouldDismount(e = i.default.dist(this.p1.pos, this.p2.pos)) {
    return (0, o.getDiff)(this.length, e) * 0.5 > this.computedEndurance;
  }
  getSnapshot() {
    return {
      type: this.type,
      name: this.name,
      p1: this.p1.name,
      p2: this.p2.name,
      length: this.length,
      computedEndurance: this.computedEndurance
    };
  }
  getStrain() {
    if (!this.entity.riderMounted) {
      return 0;
    }
    let e = i.default.dist(this.p1.pos, this.p2.pos);
    return Math.abs(e - this.length) * this.strength;
  }
};
module.exports = exports.default;