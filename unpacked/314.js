Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addModMiddleware = function (e) {
  r = [...r, e];
};
let r = [];
let i = r;
exports.default = () => e => {
  let t = null;
  return n => function (o) {
    if (r !== i) {
      const o = r.map(t => t(e));
      t = o.map((e, t) => e(o[t + 1] || n));
      i = r;
    }
    if (t && t.length > 0) {
      return t[0](o);
    } else {
      return n(o);
    }
  };
};