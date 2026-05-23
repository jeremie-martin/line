Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = class {
  constructor(e, t = "", n = true, r = true) {
    this.id = e;
    this.name = t;
    this.visible = n;
    this.editable = r;
  }
  toJSON() {
    const e = {
      id: this.id,
      type: this.type,
      name: this.name,
      visible: this.visible,
      editable: this.editable
    };
    if (this.folderId !== undefined) {
      e.folderId = this.folderId;
    }
    if (this.size !== undefined) {
      e.size = this.size;
    }
    return e;
  }
};
module.exports = exports.default;