let r = require("./310.js").compressToBase64;
const i = 1;
const o = 2;
function a(e, t = 1) {
  return JSON.stringify(e, null, t).replace(/^ +/gm, "");
}
module.exports = function (e, t = true) {
  let n = a(e = Object.assign({}, e));
  if (t && n.length > 500000) {
    let t = e.lines.map(({
      type: e,
      id: t,
      x1: n,
      y1: r,
      x2: a,
      y2: s,
      leftExtended: l,
      rightExtended: u,
      flipped: c,
      leftLine: d,
      rightLine: f
    }) => {
      let p = [e, t, n, r, a, s];
      if ((e = e) === 0 || e === 1) {
        let e = (l && i) | (u && o);
        p = p.concat([e, c | 0]);
        if (d) {
          p[8] = d;
        }
        if (f) {
          p[8] = typeof p[8] == "number" ? p[8] : null;
          p[9] = f;
        }
      }
      return p;
    });
    delete e.lines;
    e.linesArray = t;
    if ((n = a(e)).length > 500000) {
      delete e.linesArray;
      e.linesArrayCompressed = r(JSON.stringify(t));
      n = a(e);
    }
  }
  var s;
  return n;
};