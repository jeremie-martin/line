Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = require("./551.js").parseCSSColor;
class i {
  constructor(e, t, n, r) {
    this.r = e;
    this.g = t;
    this.b = n;
    this.a = r;
  }
  equals(e) {
    return this === e || e instanceof i && this.r === e.r && this.g === e.g && this.b === e.b && this.a === e.a;
  }
  toJSON() {
    return {
      r: this.r,
      g: this.g,
      b: this.b,
      a: this.a
    };
  }
}
exports.default = i;
i.Transparent = new i(0, 0, 0, 0);
i.fromRGB = function (e, t, n) {
  return new i(e, t, n, 255);
};
i.fromRGBA = function (e, t, n, r) {
  return new i(e, t, n, r);
};
i.fromCSS = function (e) {
  const t = r(e);
  return new i(t[0], t[1], t[2], t[3] * 255);
};
i.fromObj = function (e) {
  return new i(e.r, e.g, e.b, e.a);
};
module.exports = exports.default;