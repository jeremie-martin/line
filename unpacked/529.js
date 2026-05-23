Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./65.js"));
var i = o(require("./16.js"));
require("./83.js");
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
class a extends r.default {
  constructor(e, t, n) {
    super(e, t, n);
    this.q1 = t.getPoint(e.q1);
    this.q2 = t.getPoint(e.q2);
    this.key = e.key;
  }
  getSnapshot() {
    return {
      type: this.type,
      name: this.name,
      p1: this.p1.name,
      p2: this.p2.name,
      q1: this.q1.name,
      q2: this.q2.name,
      key: this.key
    };
  }
  resolve() {
    if (this.entity[this.key] && this.shouldDismount()) {
      this.entity[this.key] = false;
    }
  }
  shouldDismount() {
    return i.default.cross(new i.default(this.p2.pos).sub(this.p1.pos), new i.default(this.q2.pos).sub(this.q1.pos)) < 0;
  }
}
exports.default = a;
a.iterating = false;
module.exports = exports.default;