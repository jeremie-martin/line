Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = class {
  static get usesSwatches() {
    return false;
  }
  static getCursor(e) {
    return "inherit";
  }
  static getSceneLayer(e) {
    return null;
  }
  onTrigger(e, t) {
    return t();
  }
  onPlaybackStateChange(e) {}
  onWheel(e) {}
  onHover(e) {}
  onPointerDown(e) {}
  onPointerUp(e) {}
  onPointerDrag(e) {}
  onMiddleButtonDown(e) {}
  onMiddleButtonUp(e) {}
  onMiddleButtonDrag(e) {}
  onRightButtonDown(e) {}
  onRightButtonUp(e) {}
  onRightButtonDrag(e) {}
  onMultiTouchDown(e) {}
  onMultiTouchUp(e) {}
  onMultiTouchDrag(e) {}
};
module.exports = exports.default;