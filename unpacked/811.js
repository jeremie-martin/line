Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./370.js");
exports.default = class {
  constructor(e) {
    this.zIndex = e.zIndex;
    this.entity = e;
    this.removed = false;
    const t = (0, r.costOf)(e);
    this.vboIndex = -1;
    this.iboIndex = -1;
    this.vboLength = t.verts;
    this.iboLength = t.indices;
  }
  remove() {
    this.removed = true;
  }
  replace(e) {
    const t = (0, r.costOf)(e);
    this.removed = false;
    this.entity = e;
    this.vboIndex = -1;
    this.iboIndex = -1;
    this.vboLength = t.verts;
    this.iboLength = t.indices;
  }
};
module.exports = exports.default;