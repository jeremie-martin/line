Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./34.js");
var o = require("./22.js");
var a = require("./57.js");
var s = (r = a) && r.__esModule ? r : {
  default: r
};
var l = require("./8.js");
const u = {
  url1x: `url("${(0, i.toSvgCursorString)(o.Pan.Data, 1)}")`,
  url2x: `url("${(0, i.toSvgCursorString)(o.Pan.Data, 2)}")`,
  hotspot: {
    x: 12,
    y: 12
  },
  fallback: "auto"
};
exports.default = class extends s.default {
  static getCursor(e) {
    if ((0, l.getPlayerRunning)(e)) {
      return "inherit";
    } else {
      return u;
    }
  }
  onPointerDown(e) {
    super.onPointerDown();
    this.panStart(e);
  }
  onPointerUp(e) {
    this.panEnd(e);
  }
  onPointerDrag(e) {
    this.panDrag(e);
  }
};
module.exports = exports.default;