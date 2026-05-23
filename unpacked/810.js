Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = s(require("./25.js"));
var i = s(require("./811.js"));
var o = require("./370.js");
var a = require("./169.js");
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const l = r.default.ArrayAlgorithms.findInsertionIndexWithBinarySearch;
const u = r.default.ArrayAlgorithms.findIndexWithBinarySearch;
class c {
  constructor(e, t) {
    this.beginIndex = e;
    this.endIndex = t;
    this.buffer = null;
    this.entries = [];
    this.changed = true;
    this.numVerts = 0;
    this.numIndices = 0;
  }
  add(e) {
    this.changed = true;
    const t = l(this.entries, e.zIndex, e => e.zIndex);
    if (t > 0 && this.entries[t - 1].zIndex === e.zIndex) {
      this.entries[t - 1].replace(e);
    } else {
      this.entries.splice(t, 0, new i.default(e));
    }
  }
  remove(e) {
    this.changed = true;
    const t = u(this.entries, e.zIndex, e => e.zIndex);
    this.entries[t].remove();
  }
  render(e, t, n, r) {
    let i = null;
    if (this.buffer == null || this.changed) {
      i = this._prepareBuffer(e, n);
    }
    if (this.entries.length !== 0 && r) {
      e.bindBuffer(e.ARRAY_BUFFER, this.buffer.vbo);
      e.bindBuffer(e.ELEMENT_ARRAY_BUFFER, this.buffer.ibo);
      e.enableVertexAttribArray(t.pos);
      e.vertexAttribPointer(t.pos, 2, e.FLOAT, false, a.VERTEX_SIZE_BYTES, 0);
      e.enableVertexAttribArray(t.drpos);
      e.vertexAttribPointer(t.drpos, 2, e.SHORT, true, a.VERTEX_SIZE_BYTES, 8);
      e.enableVertexAttribArray(t.baryUnitLengthNormalised);
      e.vertexAttribPointer(t.baryUnitLengthNormalised, 1, e.UNSIGNED_SHORT, true, a.VERTEX_SIZE_BYTES, 12);
      e.enableVertexAttribArray(t.baryIndex);
      e.vertexAttribPointer(t.baryIndex, 1, e.UNSIGNED_BYTE, false, a.VERTEX_SIZE_BYTES, 14);
      e.enableVertexAttribArray(t.radius);
      e.vertexAttribPointer(t.radius, 1, e.UNSIGNED_SHORT, true, a.VERTEX_SIZE_BYTES, 16);
      e.enableVertexAttribArray(t.norm);
      e.vertexAttribPointer(t.norm, 2, e.BYTE, true, a.VERTEX_SIZE_BYTES, 18);
      e.enableVertexAttribArray(t.colorA);
      e.vertexAttribPointer(t.colorA, 4, e.UNSIGNED_BYTE, true, a.VERTEX_SIZE_BYTES, 20);
      e.enableVertexAttribArray(t.colorB);
      e.vertexAttribPointer(t.colorB, 4, e.UNSIGNED_BYTE, true, a.VERTEX_SIZE_BYTES, 24);
      e.drawElements(e.TRIANGLES, this.numIndices, e.UNSIGNED_SHORT, 0);
      return i;
    } else {
      return i;
    }
  }
  _prepareBuffer(e, t) {
    for (let o = 0; o < this.entries.length; ++o) {
      if (this.entries[o].removed) {
        this.entries.splice(o, 1);
        o -= 1;
      }
    }
    let n = false;
    if (this.buffer == null) {
      this.buffer = t(this);
      n = true;
    }
    let r = 0;
    let i = 0;
    let s = null;
    let l = (e, t, n, i, o, s, l, u, c, d, f) => {
      const p = a.VERTEX_SIZE_BYTES / 4 * r;
      const h = a.VERTEX_SIZE_BYTES * r;
      const m = a.VERTEX_SIZE_BYTES / 2 * r;
      var y = n - e;
      var g = i - t;
      this.buffer.vboFloatView[p] = e;
      this.buffer.vboFloatView[p + 1] = t;
      this.buffer.vboInt16View[m + 4] = Math.round(y * 63.998046875);
      this.buffer.vboInt16View[m + 5] = Math.round(g * 63.998046875);
      this.buffer.vboUint16View[m + 6] = Math.round(c * 63.999023438);
      this.buffer.vboUint8View[h + 14] = u;
      this.buffer.vboUint8View[h + 15] = 0;
      this.buffer.vboUint16View[m + 8] = Math.round(o * 63.999023438);
      this.buffer.vboInt8View[h + 18] = Math.round(s * 63.5);
      this.buffer.vboInt8View[h + 19] = Math.round(l * 63.5);
      this.buffer.vboUint8View[h + 20] = d.r;
      this.buffer.vboUint8View[h + 21] = d.g;
      this.buffer.vboUint8View[h + 22] = d.b;
      this.buffer.vboUint8View[h + 23] = d.a;
      this.buffer.vboUint8View[h + 24] = f.r;
      this.buffer.vboUint8View[h + 25] = f.g;
      this.buffer.vboUint8View[h + 26] = f.b;
      this.buffer.vboUint8View[h + 27] = f.a;
      return r++;
    };
    let u = e => {
      this.buffer.iboUint16View[i++] = e;
    };
    let d = (...e) => {
      for (let t = 0, n = e.length; t < n; ++t) {
        u(e[t]);
      }
    };
    let f = -1;
    let p = -1;
    let h = -1;
    let m = -1;
    for (let y = 0; y < this.entries.length; ++y) {
      const e = this.entries[y];
      if (n) {
        e.vboIndex = -1;
        e.iboIndex = -1;
      }
      if (i + e.iboLength > this.buffer.iboSize || r + e.vboLength > this.buffer.vboSize) {
        let t = new c(e.zIndex, this.endIndex);
        this.endIndex = e.zIndex;
        t.entries = this.entries.splice(y, this.entries.length - y);
        s = [t];
        break;
      }
      if (e.iboIndex === i && e.vboIndex === r) {
        i += e.iboLength;
        r += e.vboLength;
      } else if (e.iboIndex > i && e.vboIndex > r) {
        if (f < 0) {
          f = r;
          p = i;
        }
        h = r + e.vboLength;
        m = i + e.iboLength;
        const t = e.vboIndex - r;
        const n = t * a.VERTEX_SIZE_BYTES;
        const o = e.vboIndex * a.VERTEX_SIZE_BYTES;
        const s = o + e.vboLength * a.VERTEX_SIZE_BYTES;
        for (let e = o; e < s; ++e) {
          this.buffer.vboUint8View[e - n] = this.buffer.vboUint8View[e];
        }
        for (let r = 0; r < e.iboLength; ++r) {
          this.buffer.iboUint16View[i + r] = this.buffer.iboUint16View[e.iboIndex + r] - t;
        }
        e.iboIndex = i;
        e.vboIndex = r;
        i += e.iboLength;
        r += e.vboLength;
      } else {
        if (f < 0) {
          f = r;
          p = i;
        }
        h = r + e.vboLength;
        m = i + e.iboLength;
        e.iboIndex = i;
        e.vboIndex = r;
        (0, o.generate)(e.entity, l, d);
      }
    }
    this.numVerts = r;
    this.numIndices = i;
    this.changed = false;
    if (f >= 0) {
      e.bindBuffer(e.ARRAY_BUFFER, this.buffer.vbo);
      e.bindBuffer(e.ELEMENT_ARRAY_BUFFER, this.buffer.ibo);
      e.bufferSubData(e.ARRAY_BUFFER, f * a.VERTEX_SIZE_BYTES, new Uint8Array(this.buffer.vboData, f * a.VERTEX_SIZE_BYTES, (h - f) * a.VERTEX_SIZE_BYTES));
      e.bufferSubData(e.ELEMENT_ARRAY_BUFFER, p * 2, new Uint8Array(this.buffer.iboData, p * 2, (m - p) * 2));
    }
    return s;
  }
}
exports.default = c;
module.exports = exports.default;