let r = require("./310.js").decompressFromBase64;
const i = ["type", "id", "x1", "y1", "x2", "y2", "extended", "flipped", "leftLine", "rightLine"];
module.exports = function (e) {
  let t = JSON.parse(e);
  if (typeof t.linesArrayCompressed == "string") {
    t.linesArray = JSON.parse(r(t.linesArrayCompressed));
    delete t.linesArrayCompressed;
  }
  if (t.linesArray instanceof Array) {
    t.lines = t.linesArray.map(e => {
      let t = {};
      i.forEach((n, r) => {
        t[n] = e[r];
      });
      return t;
    });
    delete t.linesArray;
  }
  (function ({
    version: e,
    startPosition: t,
    lines: n
  }) {
    if (e !== "6.2" && e !== "6.1") {
      throw new Error(`This track does not have a valid version: ${e}`);
    }
    if (!(t instanceof Object) || !Number.isFinite(t.x) || !Number.isFinite(t.y)) {
      throw new Error(`This track does not contain a start position: ${t}`);
    }
    if (!(n instanceof Array)) {
      throw new Error(`This track does not have lines: ${n}`);
    }
    for (let r of n) {
      let e = r.id;
      let t = r.type;
      let n = r.x1;
      let i = r.y1;
      let o = r.x2;
      let a = r.y2;
      if (!Number.isInteger(t) || !Number.isInteger(e) || !Number.isFinite(n) || !Number.isFinite(i) || !Number.isFinite(o) || !Number.isFinite(a)) {
        throw new Error(`This track has an invalid line: ${r}`);
      }
    }
  })(t);
  return t;
};