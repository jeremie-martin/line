Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./367.js");
class i {
  constructor(e = 0, t = 0, n = 1, r = 0) {
    this.focalX = e;
    this.focalY = t;
    this.zoom = n;
    this.rotation = r;
  }
  __clone() {
    return new i(this.focalX, this.focalY, this.zoom, this.rotation);
  }
  withRectangleInFrame(e) {
    return this.__clone();
  }
  withSceneInFrame(e, t) {
    var n = r.padRect(e.boundingBox(), t);
    return this.withRectangleInFrame(n);
  }
  withAspectRatio(e) {
    var t = this.__clone();
    t.aspect = e;
    return t;
  }
  withFocalPoint(e, t) {
    return Object.assign(this.__clone(), {
      focalX: e,
      focalY: t
    });
  }
  withZoom(e) {
    return Object.assign(this.__clone(), {
      zoom: e
    });
  }
}
exports.default = i;
module.exports = exports.default;