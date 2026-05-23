Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./25.js"));
var i = a(require("./819.js"));
var o = require("./373.js");
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const s = r.default.ArrayAlgorithms.findInsertionIndexWithBinarySearch;
const l = r.default.ArrayAlgorithms.findIndexWithBinarySearch;
class u {
  constructor(e, t) {
    this.beginIndex = e;
    this.endIndex = t;
    this.buffer = null;
    this.entries = [];
    this.changed = true;
    this.numVerts = 0;
    this.numIndices = 0;
    this.beginRenderIndex = -1;
    this.endRenderIndex = -1;
  }
  onlyHasPlaceholdersOrIsEmpty() {
    for (let e of this.entries) {
      if (e.entity.type !== "placeholder") {
        return false;
      }
    }
    return true;
  }
  add(e, t) {
    this.changed = true;
    const n = s(this.entries, e.zIndex, e => e.zIndex);
    if (n > 0 && this.entries[n - 1].zIndex === e.zIndex) {
      this.entries[n - 1].replace(e, t);
    } else {
      this.entries.splice(n, 0, new i.default(e, t));
    }
  }
  remove(e) {
    this.changed = true;
    const t = l(this.entries, e.zIndex, e => e.zIndex);
    this.entries[t].remove();
  }
  render(e, t, n, r) {
    let i = null;
    if (this.buffer == null || this.changed) {
      i = this._prepareBuffer(e, n, r);
    }
    if (this.entries.length === 0) {
      return i;
    } else if (this.beginRenderIndex < 0) {
      console.warn("nothing to render in this range, why are you rendering me?", this.onlyHasPlaceholdersOrIsEmpty());
      return;
    } else {
      e.bindBuffer(e.ARRAY_BUFFER, this.buffer.vbo);
      e.bindBuffer(e.ELEMENT_ARRAY_BUFFER, this.buffer.ibo);
      e.enableVertexAttribArray(t.pos);
      e.vertexAttribPointer(t.pos, 2, e.FLOAT, false, o.VERTEX_SIZE_BYTES, 0);
      e.enableVertexAttribArray(t.texPos);
      e.vertexAttribPointer(t.texPos, 2, e.UNSIGNED_SHORT, true, o.VERTEX_SIZE_BYTES, 8);
      e.enableVertexAttribArray(t.alpha);
      e.vertexAttribPointer(t.alpha, 1, e.UNSIGNED_BYTE, true, o.VERTEX_SIZE_BYTES, 12);
      e.drawElements(e.TRIANGLES, this.endRenderIndex - this.beginRenderIndex, e.UNSIGNED_SHORT, this.beginRenderIndex * 2);
      return i;
    }
  }
  _prepareBuffer(e, t, n) {
    for (let o = 0; o < this.entries.length; ++o) {
      if (this.entries[o].removed) {
        this.entries.splice(o, 1);
        o -= 1;
      }
    }
    let r = false;
    if (this.buffer == null) {
      this.buffer = t(this);
      r = true;
    }
    let i = 0;
    let a = 0;
    let s = null;
    let l = (e, t, n, r, a) => {
      const s = o.VERTEX_SIZE_BYTES / 4 * i;
      const l = o.VERTEX_SIZE_BYTES * i;
      const u = o.VERTEX_SIZE_BYTES / 2 * i;
      this.buffer.vboFloatView[s] = e;
      this.buffer.vboFloatView[s + 1] = t;
      this.buffer.vboUint16View[u + 4] = n * 65535;
      this.buffer.vboUint16View[u + 5] = r * 65535;
      this.buffer.vboUint8View[l + 12] = a * 255;
      return i++;
    };
    let c = e => {
      this.buffer.iboUint16View[a++] = e;
    };
    let d = (...e) => {
      for (let t = 0, n = e.length; t < n; ++t) {
        c(e[t]);
      }
    };
    let f = -1;
    let p = -1;
    let h = -1;
    let m = -1;
    this.beginRenderIndex = -1;
    this.endRenderIndex = -1;
    for (let y = 0; y < this.entries.length; ++y) {
      const e = this.entries[y];
      if (r) {
        e.vboIndex = -1;
        e.iboIndex = -1;
      }
      if (a + e.iboLength > this.buffer.iboSize || i + e.vboLength > this.buffer.vboSize) {
        let t = new u(e.zIndex, this.endIndex);
        this.endIndex = e.zIndex;
        t.entries = this.entries.splice(y, this.entries.length - y);
        s = [t];
        this.endRenderIndex = this.endIndex;
        break;
      }
      if (this.beginRenderIndex < 0 && e.entity.type !== "placeholder") {
        this.beginRenderIndex = a;
      }
      if (e.iboIndex === a && e.vboIndex === i) {
        a += e.iboLength;
        i += e.vboLength;
      } else if (e.iboIndex > a && e.vboIndex > i) {
        if (f < 0) {
          f = i;
          p = a;
        }
        h = i + e.vboLength;
        m = a + e.iboLength;
        const t = e.vboIndex - i;
        const n = t * o.VERTEX_SIZE_BYTES;
        const r = e.vboIndex * o.VERTEX_SIZE_BYTES;
        const s = r + e.vboLength * o.VERTEX_SIZE_BYTES;
        for (let e = r; e < s; ++e) {
          this.buffer.vboUint8View[e - n] = this.buffer.vboUint8View[e];
        }
        for (let i = 0; i < e.iboLength; ++i) {
          this.buffer.iboUint16View[a + i] = this.buffer.iboUint16View[e.iboIndex + i] - t;
        }
        e.iboIndex = a;
        e.vboIndex = i;
        a += e.iboLength;
        i += e.vboLength;
      } else {
        e.iboIndex = a;
        e.vboIndex = i;
        if (e.entity.type === "placeholder") {
          i += e.entity.numVerts;
          a += e.entity.numIndices;
        } else {
          if (f < 0) {
            f = i;
            p = a;
          }
          h = i + e.vboLength;
          m = a + e.iboLength;
          (0, o.generate)(e.entity, l, d, n);
        }
      }
      if (e.entity.type !== "placeholder") {
        this.endRenderIndex = a;
      }
    }
    this.numVerts = i;
    this.numIndices = a;
    this.changed = false;
    if (f >= 0) {
      e.bindBuffer(e.ARRAY_BUFFER, this.buffer.vbo);
      e.bindBuffer(e.ELEMENT_ARRAY_BUFFER, this.buffer.ibo);
      e.bufferSubData(e.ARRAY_BUFFER, f * o.VERTEX_SIZE_BYTES, new Uint8Array(this.buffer.vboData, f * o.VERTEX_SIZE_BYTES, (h - f) * o.VERTEX_SIZE_BYTES));
      e.bufferSubData(e.ELEMENT_ARRAY_BUFFER, p * 2, new Uint8Array(this.buffer.iboData, p * 2, (m - p) * 2));
    }
    return s;
  }
}
exports.default = u;
module.exports = exports.default;