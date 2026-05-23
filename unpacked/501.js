Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./284.js"));
var i = o(require("./144.js"));
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
  constructor(e) {
    super(e);
  }
  get type() {
    return i.default.SCENERY;
  }
};
module.exports = exports.default;