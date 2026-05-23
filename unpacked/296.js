Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = [1, 4, 2, 8, 16, 32];
exports.NUM_BUTTONS = 3;
exports.isButtonPressed = (e, t) => !!(r[e] & t);
exports.Button = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2
};