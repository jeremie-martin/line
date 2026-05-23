Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./64.js"));
var i = a(require("./283.js"));
var o = a(require("./144.js"));
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
    this.c.acc = this.acc;
  }
  get type() {
    return o.default.ACC;
  }
  get acc() {
    return (0, r.default)(this.norm).rotCW().mul(s * (this.flipped ? -1 : 1));
  }
  doCollide(e, t, n) {
    n.add(this.c.acc);
    return e.updateState({
      pos: t,
      prevPos: n
    });
  }
};
module.exports = exports.default;