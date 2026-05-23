Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./25.js");
exports.default = class {
  constructor() {
    this.lines = [];
  }
  addLine(e) {
    let t = r.ArrayAlgorithms.findInsertionIndexWithBinarySearch(this.lines, e.id, e => e.id);
    this.lines.splice(t, 0, e);
  }
  removeLine(e) {
    let t = r.ArrayAlgorithms.findIndexWithBinarySearch(this.lines, e.id, e => e.id);
    this.lines.splice(t, 1);
  }
  empty() {
    return this.lines.length == 0;
  }
};
module.exports = exports.default;