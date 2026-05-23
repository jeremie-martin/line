Object.defineProperty(exports, "__esModule", {
  value: true
});
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
exports.genEditorLinesForSolidLine = function (e) {
  let t = m.Solid;
  let n = m.Black;
  if (e.flipped) {
    t = m.Black;
    n = m.Solid;
  }
  return [new i.default.Line({
    x: e.p1.x,
    y: e.p1.y,
    colorA: t,
    colorB: n,
    thickness: c
  }, {
    x: e.p2.x + (e.p1.equals(e.p2) ? d : 0),
    y: e.p2.y,
    colorA: t,
    colorB: n,
    thickness: c
  }, s.COLLIDING_LAYER, e.id)];
};
exports.genEditorLinesForAccLine = function (e) {
  let t = m.Acc;
  let n = m.Black;
  if (e.flipped) {
    t = m.Black;
    n = m.Acc;
  }
  let r = new i.default.Line({
    x: e.p1.x,
    y: e.p1.y,
    colorA: t,
    colorB: n,
    thickness: c
  }, {
    x: e.p2.x + (e.p1.equals(e.p2) ? d : 0),
    y: e.p2.y,
    colorA: t,
    colorB: n,
    thickness: c
  }, s.COLLIDING_LAYER, e.id + 0.1);
  if (e.length > 0) {
    const t = g(e);
    let n = y.p0.set(e.p2).add(y.norm);
    let o = y.p1.set(e.p2).add(y.vec2.set(y.vec).mul(y.arrowOffset.x)).add(y.norm.mul(y.arrowOffset.y));
    let a = y.p2.set(e.p2).add(y.vec.mul(-Math.min(1.5, 1 + e.length / t)));
    return [new i.default.Triangle({
      x: n.x,
      y: n.y,
      color: m.Acc
    }, {
      x: o.x,
      y: o.y,
      color: m.Acc
    }, {
      x: a.x,
      y: a.y,
      color: m.Acc
    }, s.COLLIDING_LAYER, e.id), r];
  }
  return [r];
};
exports.genEditorLinesForSceneryLine = function (e) {
  const t = e.width ? e.width * 2 : c;
  return [new i.default.Line({
    x: e.p1.x,
    y: e.p1.y,
    colorA: m.Scenery,
    colorB: m.Scenery,
    thickness: t
  }, {
    x: e.p2.x + (e.p1.equals(e.p2) ? d : 0),
    y: e.p2.y,
    colorA: m.Scenery,
    colorB: m.Scenery,
    thickness: t
  }, s.SCENERY_LAYER, e.id)];
};
exports.genPlaybackLinesForLine = function (e, t) {
  let n = m.Black;
  if (t) {
    if (t in v) {
      n = v[t];
    } else {
      var o = t.substring(1).match(/.{2}/g).map(e => parseInt(e, 16));
      var a = r(o, 3);
      const e = a[0];
      const s = a[1];
      const l = a[2];
      n = i.default.Color.fromRGB(e, s, l);
      v[t] = n;
    }
  }
  const l = e.width ? e.width * 2 : c;
  return [new i.default.Line({
    x: e.p1.x,
    y: e.p1.y,
    colorA: n,
    colorB: n,
    thickness: l
  }, {
    x: e.p2.x + (e.p1.equals(e.p2) ? d : 0),
    y: e.p2.y,
    colorA: n,
    colorB: n,
    thickness: l
  }, s.LINE_LAYER, e.id)];
};
exports.genLineHitbox = function (e) {
  let t = e.p1;
  let n = e.p2;
  if (e.leftExtended) {
    t = new o.default(e.vec).mul(-e.extension).add(e.p1);
  }
  if (e.rightExtended) {
    n = new o.default(e.vec).mul(e.extension).add(e.p2);
  }
  const r = new o.default(e.norm).mul(b);
  if (!e.flipped) {
    let e = t;
    t = n;
    n = e;
  }
  let u = new o.default(r).add(n);
  let d = r.add(t);
  const f = new l.default({
    x: t.x,
    y: t.y,
    color: m.Hitbox
  }, {
    x: n.x,
    y: n.y,
    color: m.Hitbox
  }, {
    x: u.x,
    y: u.y,
    color: m.Hitbox
  }, {
    x: d.x,
    y: d.y,
    color: m.Hitbox
  }, 0, e.id);
  let p;
  switch (e.type) {
    case a.SOLID_LINE:
      p = m.Solid;
      break;
    case a.ACC_LINE:
      p = m.Acc;
  }
  const h = new i.default.Line({
    x: t.x,
    y: t.y,
    colorA: p,
    colorB: p,
    thickness: c / 16
  }, {
    x: n.x,
    y: n.y,
    colorA: p,
    colorB: p,
    thickness: c / 16
  }, s.COLLIDING_LAYER, e.id + 0.5);
  if (e.type === a.ACC_LINE) {
    g(e);
    let t = y.p1.set(e.p2).add(y.vec2.set(y.vec).mul(y.arrowOffset.x / 2)).add(y.norm.mul(y.arrowOffset.y / 2));
    return [f, h, new i.default.Line({
      x: e.p2.x,
      y: e.p2.y,
      colorA: p,
      colorB: p,
      thickness: c / 16
    }, {
      x: t.x,
      y: t.y,
      colorA: p,
      colorB: p,
      thickness: 0
    }, s.COLLIDING_LAYER, e.id + 0.75)];
  }
  return [f, h];
};
var i = u(require("./168.js"));
var o = u(require("./16.js"));
var a = require("./81.js");
var s = require("./127.js");
var l = u(require("./167.js"));
function u(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const c = 2;
const d = 0.001;
const f = (0, a.getTypeInfo)(a.SOLID_LINE).color;
const p = (0, a.getTypeInfo)(a.ACC_LINE).color;
const h = (0, a.getTypeInfo)(a.SCENERY_LINE).color;
const m = {
  Black: i.default.Color.fromRGB(0, 0, 0),
  Solid: i.default.Color.fromRGB(...f),
  Acc: i.default.Color.fromRGB(...p),
  Scenery: i.default.Color.fromRGB(...h),
  Hitbox: new i.default.Color(0, 0, 0, 32)
};
let y = {
  vec: o.default.from(0, 0),
  vec2: o.default.from(0, 0),
  norm: o.default.from(0, 0),
  p0: o.default.from(0, 0),
  p1: o.default.from(0, 0),
  p2: o.default.from(0, 0),
  arrowOffset: o.default.from(0, 0)
};
function g(e) {
  let t = e.multiplier ?? 1;
  let n = Math.log2(t + 1) * -2.5 - 0.5;
  let r = (1.5 - 1 / (1 + t)) * 3;
  let i = c / 2;
  y.vec.set(e.vec).div(e.length).mul(i);
  y.norm.set(e.norm).mul(i);
  y.arrowOffset.x = n;
  y.arrowOffset.y = r;
  return i;
}
const v = {};
const b = 10;