Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./373.js");
exports.default = class {
  constructor(e, t) {
    this.zIndex = e.zIndex;
    this.entity = e;
    this.removed = false;
    const n = (0, r.costOf)(e, t);
    this.vboIndex = -1;
    this.iboIndex = -1;
    this.vboLength = n.verts;
    this.iboLength = n.indices;
  }
  remove() {
    this.removed = true;
  }
  replace(e, t) {
    const n = (0, r.costOf)(e, t);
    this.removed = false;
    this.entity = e;
    this.vboIndex = -1;
    this.iboIndex = -1;
    this.vboLength = n.verts;
    this.iboLength = n.indices;
  }
};
module.exports = exports.default;