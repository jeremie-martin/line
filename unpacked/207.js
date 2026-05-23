Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./66.js"));
var i = a(require("./25.js"));
var o = a(require("./107.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
class s {
  constructor() {
    this.layers = new i.default.List();
    this.bgColor = r.default.fromRGB(255, 255, 255);
  }
  __clone() {
    return Object.assign(new s(), {
      layers: this.layers,
      bgColor: this.bgColor
    });
  }
  withBackgroundColor(e) {
    return Object.assign(this.__clone(), {
      bgColor: e
    });
  }
  boundingBox() {
    if (this.layers.size() === 0) {
      return {
        x: -1,
        y: -1,
        width: 2,
        height: 2
      };
    }
    let e = Number.MAX_VALUE;
    let t = Number.MAX_VALUE;
    let n = -Number.MAX_VALUE;
    let r = -Number.MAX_VALUE;
    this.layers.forEach(i => {
      const o = i.boundingBox();
      e = Math.min(o.x, e);
      t = Math.min(o.y, t);
      n = Math.max(o.x + o.width, n);
      r = Math.max(o.y + o.height, r);
    });
    return {
      x: e,
      y: t,
      width: n - e,
      height: r - t
    };
  }
  withEntityAdded(e) {
    let t = this.__clone();
    if (e.layerIndex === null || e.layerIndex === undefined) {
      console.error("invalid entity layer index", e);
    }
    let n = t.layers.findIndexWithBinarySearch(e.layerIndex, e => e.layerIndex);
    if (n === -1) {
      n = t.layers.findInsertionIndexWithBinarySearch(e.layerIndex, e => e.layerIndex);
      t.layers = t.layers.withValueAdded(n, new o.default(e.layerIndex));
    }
    t.layers = t.layers.withMutation(n, t => t.withEntityAdded(e));
    return t;
  }
  withEntitiesInZIndexRangeRemoved(e, t) {
    let n = this.layers.map(n => n.withEntitiesInZIndexRangeRemoved(e, t)).filter(e => e.entities.size() > 0);
    if (n === this.layers) {
      return this;
    }
    let r = this.__clone();
    r.layers = n;
    return r;
  }
  withLayerRemoved(e) {
    let t = this.layers.findIndexWithBinarySearch(e, e => e.layerIndex);
    if (t === -1) {
      return this;
    }
    let n = this.__clone();
    n.layers = this.layers.withValueRemoved(t);
    return n;
  }
  withLayerAdded(e) {
    let t = this.layers.findInsertionIndexWithBinarySearch(e.layerIndex, e => e.layerIndex);
    if (t < this.layers.size() && this.layers.get(t).layerIndex === e.layerIndex) {
      throw new Error("already have a layer with index " + e.layerIndex);
    }
    let n = this.__clone();
    n.layers = this.layers.withValueAdded(t, e);
    return n;
  }
  getLayer(e) {
    let t = this.getLayerOrNull(e);
    if (t == null) {
      return new o.default(e);
    } else {
      return t;
    }
  }
  getLayerOrNull(e) {
    let t = this.layers.findIndexWithBinarySearch(e, e => e.layerIndex);
    if (t === -1) {
      return null;
    } else {
      return this.layers.get(t);
    }
  }
}
exports.default = s;
s.fromEntities = function (e) {
  if (e.length === 0) {
    return new s();
  }
  for (let i = 0; i < e.length; ++i) {
    const t = e[i];
    if (t.layerIndex === null || t.layerIndex === undefined) {
      throw new Error("invalid entity layer index", t);
    }
  }
  e.sort((e, t) => {
    if (e.layerIndex < t.layerIndex) {
      return -1;
    }
    if (e.layerIndex > t.layerIndex) {
      return 1;
    }
    if (e.zIndex < t.zIndex) {
      return -1;
    }
    if (e.zIndex > t.zIndex) {
      return 1;
    }
    throw new Error("two entities in the same layer cannot have the same zIndex");
  });
  let t = [];
  let n = e[0].layerIndex;
  let r = 0;
  for (let s = 0; s < e.length; ++s) {
    const a = e[s];
    if (a.layerIndex !== n) {
      const l = new o.default(n);
      l.entities = new i.default.List(e.slice(r, s));
      t.push(l);
      n = a.layerIndex;
      r = s;
    }
  }
  const a = new o.default(n);
  a.entities = new i.default.List(e.slice(r));
  t.push(a);
  let l = new s();
  l.layers = new i.default.List(t);
  return l;
};
module.exports = exports.default;