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
  constructor(e, t = "", n = true, r = true, i = 0) {
    super(e, t, n, r);
    this.size = i;
  }
  get type() {
    return i.default.FOLDER;
  }
};
module.exports = exports.default;