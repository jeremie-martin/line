Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = class {
  constructor(e, t, n) {
    this.entity = t;
    this.name = e.name;
    this.type = e.type;
  }
  getSnapshot() {
    return {
      type: this.type,
      name: this.name
    };
  }
};
module.exports = exports.default;