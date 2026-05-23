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
exports.default = class extends r.default {
  resolve() {
    let e = i.default.dist(this.p1.pos, this.p2.pos);
    if (!(e >= this.length)) {
      super.resolve(e);
    }
  }
  getStrain() {
    let e = i.default.dist(this.p1.pos, this.p2.pos);
    if (e >= this.length) {
      return 0;
    } else {
      return Math.abs(e - this.length) * this.strength;
    }
  }
};
module.exports = exports.default;