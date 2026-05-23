Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./282.js"));
var i = o(require("./199.js"));
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
  constructor(e, t = "", n = true, r = true, i = -1) {
    super(e, t, n, r);
    if (!t.match(/^#[0-9a-fA-F]{6}/)) {
      this.name = `#000000${this.name}`;
    }
    this.folderId = i;
  }
  get type() {
    return i.default.LAYER;
  }
};
module.exports = exports.default;