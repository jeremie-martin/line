Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.normalizeDelta = function (e) {
  switch (e.deltaMode) {
    case r.PIXEL:
      return 0.25;
    case r.LINE:
      return 20;
    case r.PAGE:
      return 1;
  }
};
const r = exports.DeltaMode = {
  PIXEL: 0,
  LINE: 1,
  PAGE: 2
};