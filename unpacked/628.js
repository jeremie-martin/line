Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t, n, r, i) {
  const l = n * a;
  const u = n * s;
  const c = r * a;
  const d = r * s;
  let f = 0;
  let p = 0;
  let h = function (e, t, n, r, i) {
    return new o.default(e).sub(t).mul(i).add(new o.default({
      x: n / 2,
      y: r / 2
    }));
  }(t, e, n, r, i);
  if (h.x < l) {
    f += l - h.x;
  }
  if (h.y < c) {
    p += c - h.y;
  }
  if (h.x > u) {
    f -= h.x - u;
  }
  if (h.y > d) {
    p -= h.y - d;
  }
  return new o.default({
    x: e.x - f / i,
    y: e.y - p / i
  });
};
var r;
var i = require("./16.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
const a = 0.38197;
const s = 0.61803;
module.exports = exports.default;