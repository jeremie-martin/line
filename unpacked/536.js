Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./65.js"));
var i = a(require("./16.js"));
var o = require("./105.js");
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
class s extends r.default {
  constructor(e, t, n) {
    super(e, t, n);
    this.q1 = t.getPoint(e.q1);
    this.q2 = t.getPoint(e.q2);
    this.sled = e.sled;
  }
  getSnapshot() {
    return {
      type: this.type,
      name: this.name,
      p1: this.p1.name,
      p2: this.p2.name,
      q1: this.q1.name,
      q2: this.q2.name,
      sled: this.sled
    };
  }
  resolve() {
    switch (this.entity.riderState) {
      case o.RiderState.DISMOUNTING:
      case o.RiderState.DISMOUNTED:
        return;
    }
    if (this.shouldDismount()) {
      this.entity.riderState = this.entity.riderState === o.RiderState.MOUNTED ? o.RiderState.DISMOUNTING : o.RiderState.DISMOUNTED;
      this.entity.frameCounter = -1;
      if (this.sled && this.entity.sledState === o.SledState.INTACT) {
        this.entity.sledState = o.SledState.BROKEN;
      }
    }
  }
  shouldDismount() {
    return i.default.cross(new i.default(this.p2.pos).sub(this.p1.pos), new i.default(this.q2.pos).sub(this.q1.pos)) < 0;
  }
}
exports.default = s;
s.iterating = false;
module.exports = exports.default;