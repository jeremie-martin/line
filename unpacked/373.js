Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VERTEX_SIZE_BYTES = undefined;
exports.costOf = function (e, t) {
  if (e.type === "placeholder") {
    return {
      verts: e.numVerts,
      indices: e.numIndices
    };
  }
  let n = t.mappings[e.type];
  if (n == null) {
    throw new Error("unknown entity type: " + e.type);
  }
  let r = n.length;
  return {
    verts: r * 4,
    indices: r * 6
  };
};
exports.generate = function (e, t, n, r) {
  let o = r.mappings[e.type];
  for (let c of o) {
    let o = (0, i.getMappingProps)(c, e.params);
    if (o.hidden) {
      let e = t(0, 0, 0, 0, 0);
      let r = t(0, 0, 0, 0, 0);
      let i = t(0, 0, 0, 0, 0);
      let o = t(0, 0, 0, 0, 0);
      n(e, r, i, e, i, o);
      continue;
    }
    let d = e.alpha;
    if (o.opacity != null) {
      d *= o.opacity;
    }
    var u = o.coords;
    let f = u.bbox;
    let p = u.anchor;
    let h = e.points[c.anchor];
    let m = new a.default({
      x: f.x - p.x,
      y: f.y - p.y
    });
    let y = new a.default({
      x: f.x - p.x,
      y: f.y + f.height - p.y
    });
    let g = new a.default({
      x: f.x + f.width - p.x,
      y: f.y + f.height - p.y
    });
    let v = new a.default({
      x: f.x + f.width - p.x,
      y: f.y - p.y
    });
    if (o.transform) {
      m.transform(o.transform);
      y.transform(o.transform);
      g.transform(o.transform);
      v.transform(o.transform);
    }
    if (c.lookAt) {
      let t = e.points[c.lookAt];
      let n = new a.default(t).sub(h);
      let r = n.angle();
      if (c.stretch) {
        let e = n.len() / (f.width - i.PADDING * 2);
        m.x *= e;
        y.x *= e;
        g.x *= e;
        v.x *= e;
      }
      m.rot(r);
      y.rot(r);
      g.rot(r);
      v.rot(r);
    }
    m.add(h);
    y.add(h);
    g.add(h);
    v.add(h);
    let b = t(m.x, m.y, s(f.x, r), l(f.y, r), d);
    let _ = t(y.x, y.y, s(f.x, r), l(f.y + f.height, r), d);
    let w = t(g.x, g.y, s(f.x + f.width, r), l(f.y + f.height, r), d);
    let x = t(v.x, v.y, s(f.x + f.width, r), l(f.y, r), d);
    n(b, _, w, b, w, x);
  }
};
var r;
var i = require("./206.js");
var o = require("./16.js");
var a = (r = o) && r.__esModule ? r : {
  default: r
};
exports.VERTEX_SIZE_BYTES = 16;
function s(e, t) {
  return e / t.width;
}
function l(e, t) {
  return e / t.height;
}