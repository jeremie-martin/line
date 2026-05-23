var r = function () {
  return function (e, t) {
    if (Array.isArray(e)) {
      return e;
    }
    if (Symbol.iterator in Object(e)) {
      return function (e, t) {
        var n = [];
        var r = true;
        var i = false;
        var o = undefined;
        try {
          for (var a, s = e[Symbol.iterator](); !(r = (a = s.next()).done) && (n.push(a.value), !t || n.length !== t); r = true);
        } catch (e) {
          i = true;
          o = e;
        } finally {
          try {
            if (!r && s.return) {
              s.return();
            }
          } finally {
            if (i) {
              throw o;
            }
          }
        }
        return n;
      }(e, t);
    }
    throw new TypeError("Invalid attempt to destructure non-iterable instance");
  };
}();
const i = 4065022548;
const o = 1;
const a = 0;
const s = 1;
const l = 2;
const u = {
  [s]: 0,
  [l]: 1,
  [a]: 2
};
const c = "REDMULTIPLIER";
const d = "SCENERYWIDTH";
const f = "SONGINFO";
const p = "IGNORABLE_TRIGGER";
const h = "6.1";
const m = {
  [c]: "Using custom acceleration!",
  [d]: "Custom scenery width not supported!",
  [f]: "Song information not supported!",
  [p]: "Line collision zooming not supported!",
  [h]: "Using 6.1!"
};
function y(e, t) {
  return [e + 8 + 8, {
    x: t.readDoubleLE(e),
    y: t.readDoubleLE(e + 8)
  }];
}
function g(e, t) {
  return t.reduce((e, t) => t(e) || e, e);
}
module.exports = function (e) {
  let t = {};
  let n = {};
  g(0, [t => {
    let n = e.readUInt32LE(t);
    if (n !== i) {
      throw new Error(`Invalid magic number. Expected ${n} to be ${i}`);
    }
    return t + 4;
  }, t => {
    let n = e.readUInt8(t);
    if (n > o) {
      throw new Error(`Only TRK versions ${o} and below are supported. This version is ${n}`);
    }
    return t + 1;
  }, n => {
    let r = e.readUInt16LE(n);
    let i = e.toString("ascii", n + 2, n + 2 + r);
    let o = n + 2 + r;
    t = {};
    i.split(";").forEach(e => {
      if (e !== "") {
        t[e] = true;
        console.warn(e, m[e]);
      }
    });
    return o;
  }, r => {
    if (t[f]) {
      let t = e.readUInt8(r);
      let i = r + 1 + t;
      let o = e.toString("ascii", r + 1, r + 1 + t);
      n.songInfo = o;
      return i;
    }
  }, t => {
    var i = y(t, e);
    var o = r(i, 2);
    let a = o[0];
    let s = o[1];
    n.startPosition = s;
    return a;
  }, i => {
    let o = [];
    let u = [];
    (function (e, t, n) {
      let r = e;
      for (let i = 0; i < t; i++) {
        r = n(r) || r;
      }
    })(i + 4, e.readUInt32LE(i), n => {
      let i = {};
      let f = g(n, [t => {
        let r = e.readUInt8(n);
        i.type = r & 31;
        if (i.type !== a) {
          i.inv = r >> 7 != 0;
          i.lim = r >> 5 & 3;
        }
        return t + 1;
      }, n => {
        if (t[c] && i.type === l) {
          i.multiplier = e.readUInt8(n);
          return n + 1;
        }
      }, n => {
        if (t[p] && (i.type === s || i.type === l)) {
          if (e.readUInt8(n)) {
            return g(n + 1, [t => {
              i.zoomtarget = e.readFloatLE(t);
              return t + 4;
            }, t => {
              i.zoomframes = e.readUInt16LE(t);
              return t + 2;
            }]);
          } else {
            return n + 1;
          }
        }
      }, t => {
        if (i.type === s || i.type === l) {
          i.id = e.readUInt32LE(t);
          return t + 4;
        }
      }, t => {
        if (i.lim != null && i.lim !== 0) {
          i.prev = e.readInt32LE(t);
          i.next = e.readInt32LE(t + 4);
          return t + 8;
        }
      }, n => {
        if (t[d] && i.type === a) {
          i.width = e.readUInt8(n) / 10;
          return n + 1;
        }
      }, t => {
        var n = y(t, e);
        var o = r(n, 2);
        let a = o[0];
        let s = o[1];
        i.x1 = s.x;
        i.y1 = s.y;
        return a;
      }, t => {
        var n = y(t, e);
        var o = r(n, 2);
        let a = o[0];
        let s = o[1];
        i.x2 = s.x;
        i.y2 = s.y;
        return a;
      }]);
      switch (i.type) {
        case s:
        case l:
          o.push(i);
          break;
        case a:
          u.push(i);
      }
      return f;
    });
    let f = o.map(({
      id: e
    }) => e).reduce((e, t) => Math.max(e, t), 0);
    u.forEach(e => {
      f += 1;
      e.id = f;
    });
    n.lines = o.concat(u);
  }]);
  return {
    label: "lra track",
    version: t[h] ? "6.1" : "6.2",
    startPosition: n.startPosition,
    lines: n.lines.map(e => {
      let t = e.x1;
      let n = e.y1;
      let r = e.x2;
      let i = e.y2;
      let o = e.lim;
      let a = e.inv;
      let s = e.prev;
      let l = e.next;
      let c = e.id;
      let d = e.type;
      let f = function (e, t) {
        var n = {};
        for (var r in e) {
          if (!(t.indexOf(r) >= 0)) {
            if (Object.prototype.hasOwnProperty.call(e, r)) {
              n[r] = e[r];
            }
          }
        }
        return n;
      }(e, ["x1", "y1", "x2", "y2", "lim", "inv", "prev", "next", "id", "type"]);
      return Object.assign({
        x1: t,
        y1: n,
        x2: r,
        y2: i,
        extended: o,
        flipped: a,
        leftLine: s,
        rightLine: l,
        id: c,
        type: u[d]
      }, f);
    })
  };
};