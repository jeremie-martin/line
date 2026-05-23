Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./294.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
exports.default = class extends o.default {
  handleCollisions(e, t) {
    const n = e.getLinesNearPos(this.pos);
    for (let r = 0; r < n.length; ++r) {
      let e = n[r];
      if (e.collide(this)) {
        t(e);
      }
    }
  }
};
module.exports = exports.default;