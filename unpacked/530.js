Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./203.js"));
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
class s extends r.default {
  constructor(e, t, n) {
    super(e, t, n);
    this.points = e.ps.map(e => t.getPoint(e));
    if (e.lengths) {
      this.lengths = e.lengths;
    } else {
      this.lengths = [];
      for (let e = 1; e < this.points.length; ++e) {
        this.lengths.push(i.default.dist(this.points[e - 1].pos, this.points[e].pos));
      }
    }
  }
  getSnapshot() {
    const e = [];
    for (let t = 0; t < this.points.length; ++t) {
      e.push(this.points[t].name);
    }
    return {
      type: this.type,
      name: this.name,
      ps: e,
      lengths: this.lengths.slice()
    };
  }
  resolve(e) {
    for (let t = 1, n = this.points.length; t < n; t++) {
      let e = this.points[t - 1];
      let n = this.points[t];
      let r = this.lengths[t - 1];
      let a = i.default.dist(e.pos, n.pos);
      let s = new i.default(e.pos).sub(n.pos).mul((0, o.getDiff)(r, a)).add(n.pos);
      this.points[t].pos = s;
    }
  }
}
exports.default = s;
s.iterating = false;
module.exports = exports.default;