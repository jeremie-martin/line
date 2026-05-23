Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./286.js"));
var i = o(require("./145.js"));
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
    if (e.width !== undefined) {
      this.width = Math.max(0.01, e.width);
      if (!window.store.getState().settings["track.uncapScenery"]) {
        this.width = Math.min(362, this.width);
      }
    } else {
      this.width = 1;
    }
  }
  get type() {
    return i.default.SCENERY;
  }
  toJSON() {
    const e = super.toJSON();
    e.width = this.width;
    return e;
  }
};
module.exports = exports.default;