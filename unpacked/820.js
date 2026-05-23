Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./372.js"));
var i = a(require("./25.js"));
var o = require("./169.js");
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
  constructor(e, t) {
    const n = t * 6;
    const r = t * 4;
    this.type = "placeholder";
    this.zIndex = e;
    this.numVerts = r;
    this.numIndices = n;
  }
}
exports.default = class {
  constructor(e, t, n, r, i, a) {
    this.gl = e;
    this.attributes = t;
    this.spriteSheet = n;
    this.getBuffer = r;
    this.returnBuffer = i;
    this.numRects = a;
    const s = a * 6;
    const l = a * 4;
    const u = Math.floor(o.NUM_INDICES / s);
    const c = Math.floor(o.NUM_VERTS / l);
    this.frameLimit = Math.min(u, c);
    this.prevEntities = null;
    this.ranges = [];
  }
  destroy() {
    for (let e of this.ranges) {
      if (e.buffer) {
        this.returnBuffer(e.buffer);
      }
    }
    this.prevEntities = null;
    this.ranges = [];
  }
  render(e) {
    if (e == null || e.size() === 0) {
      if (this.prevEntities) {
        this.destroy();
      }
      return;
    }
    if (this.prevEntities !== e) {
      if (this.prevEntities && this.prevEntities.root === e.root) {
        this.prevEntities.compareTo(e).forEachPrimitive(e => {
          if (e instanceof i.default.ListPatches.Add) {
            this.addEntity(e.value);
          } else {
            this.removeEntity(e.value);
          }
        });
      } else {
        this.destroy();
        e.forEach((e, t) => this.addEntity(e, this.spriteSheet));
      }
    }
    let t = e.get(0).index;
    let n = e.get(e.size() - 1).index;
    let r = -1;
    let o = Number.MAX_SAFE_INTEGER;
    const a = e => e.endIndex > t && e.beginIndex <= n;
    for (let i = 0; i < this.ranges.length; ++i) {
      if (a(this.ranges[i])) {
        r = i;
        break;
      }
      this.returnBuffer(this.ranges[i].buffer);
      this.ranges[i].buffer = null;
    }
    for (let i = this.ranges.length - 1; i >= 0; --i) {
      if (a(this.ranges[i])) {
        o = i;
        break;
      }
      this.returnBuffer(this.ranges[i].buffer);
      this.ranges[i].buffer = null;
    }
    if (r > 0) {
      this.ranges.splice(0, r);
    }
    if (o < this.ranges.length - 1) {
      this.ranges.splice(o + 1, this.ranges.length - (o + 1));
    }
    for (let i = 0; i < this.ranges.length; ++i) {
      if (this.ranges[i].render(this.gl, this.attributes, this.getBuffer, this.spriteSheet)) {
        throw new Error("ranges in the onion skin renderer arent allowed to overflow!");
      }
    }
    this.prevEntities = e;
  }
  addEntity(e) {
    this.getRange(e.index).add(e, this.spriteSheet);
  }
  removeEntity(e) {
    this.getRange(e.index).add(new s(e.index, this.numRects), this.spriteSheet);
  }
  createEmptyRange(e) {
    const t = new r.default(e * this.frameLimit, (e + 1) * this.frameLimit);
    const n = e * this.frameLimit;
    for (let r = 0; r < this.frameLimit; ++r) {
      t.add(new s(n + r, this.numRects), this.spriteSheet);
    }
    return t;
  }
  findRange(e) {
    for (let t of this.ranges) {
      if (t.beginIndex <= e && e < t.endIndex) {
        return t;
      }
    }
    return null;
  }
  insertRange(e) {
    for (let t = 0; t < this.ranges.length; ++t) {
      if (this.ranges[t].beginIndex > e.beginIndex) {
        this.ranges.splice(t, 0, e);
        return;
      }
    }
    this.ranges.splice(this.ranges.length, 0, e);
  }
  getRange(e) {
    let t = this.findRange(e);
    if (!t) {
      t = this.createEmptyRange(this.getRangeIndexForFrameIndex(e));
      this.insertRange(t);
    }
    return t;
  }
  getRangeIndexForFrameIndex(e) {
    return Math.floor(e / this.frameLimit);
  }
};
module.exports = exports.default;