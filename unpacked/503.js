Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./16.js"));
var i = a(require("./285.js"));
var o = a(require("./145.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const s = 0.1;
exports.default = class extends i.default {
  constructor(e) {
    super(e);
    let t = s;
    if (e.multiplier != null) {
      this.multiplier = e.multiplier;
      t = e.multiplier * t;
    }
    this.acc = new r.default(this.norm).rotCW().mul(t * (this.flipped ? -1 : 1));
  }
  get type() {
    return o.default.ACC;
  }
  onCollide(e, t, n) {
    n.add(this.acc);
    super.onCollide(e, t, n);
  }
};
module.exports = exports.default;