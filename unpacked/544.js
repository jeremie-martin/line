Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.rotate = function (e, t, n) {
  let r = t[0];
  let i = t[1];
  let o = t[2];
  let a = t[3];
  let s = t[4];
  let l = t[5];
  let u = Math.sin(n);
  let c = Math.cos(n);
  e[0] = r * c + o * u;
  e[1] = i * c + a * u;
  e[2] = r * -u + o * c;
  e[3] = i * -u + a * c;
  e[4] = s;
  e[5] = l;
  return e;
};
exports.scale = function (e, t, n) {
  let r = t[0];
  let i = t[1];
  let o = t[2];
  let a = t[3];
  let s = t[4];
  let l = t[5];
  let u = n[0];
  let c = n[1];
  e[0] = r * u;
  e[1] = i * u;
  e[2] = o * c;
  e[3] = a * c;
  e[4] = s;
  e[5] = l;
  return e;
};
exports.translate = function (e, t, n) {
  let r = t[0];
  let i = t[1];
  let o = t[2];
  let a = t[3];
  let s = t[4];
  let l = t[5];
  let u = n[0];
  let c = n[1];
  e[0] = r;
  e[1] = i;
  e[2] = o;
  e[3] = a;
  e[4] = r * u + o * c + s;
  e[5] = i * u + a * c + l;
  return e;
};
exports.fromRotation = function (e, t) {
  let n = Math.sin(t);
  let r = Math.cos(t);
  e[0] = r;
  e[1] = n;
  e[2] = -n;
  e[3] = r;
  e[4] = 0;
  e[5] = 0;
  return e;
};
exports.fromScaling = function (e, t) {
  e[0] = t[0];
  e[1] = 0;
  e[2] = 0;
  e[3] = t[1];
  e[4] = 0;
  e[5] = 0;
  return e;
};
exports.fromTranslation = function (e, t) {
  e[0] = 1;
  e[1] = 0;
  e[2] = 0;
  e[3] = 1;
  e[4] = t[0];
  e[5] = t[1];
  return e;
};