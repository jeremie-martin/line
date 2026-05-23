Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.NUM_VERTS = 65536;
const i = exports.NUM_INDICES = r * 3;
const o = exports.VERTEX_SIZE_BYTES = 28;
class a {
  static create(e) {
    try {
      return new a(e);
    } catch (e) {
      console.error("unable to create buffer", e);
      return null;
    }
  }
  constructor(e) {
    try {
      const t = r * o;
      const n = i * 2;
      this.vbo = e.createBuffer();
      e.bindBuffer(e.ARRAY_BUFFER, this.vbo);
      e.bufferData(e.ARRAY_BUFFER, t, e.DYNAMIC_DRAW);
      this.ibo = e.createBuffer();
      e.bindBuffer(e.ELEMENT_ARRAY_BUFFER, this.ibo);
      e.bufferData(e.ELEMENT_ARRAY_BUFFER, n, e.DYNAMIC_DRAW);
      this.vboData = new ArrayBuffer(t);
      this.iboData = new ArrayBuffer(n);
    } catch (t) {
      if (this.vbo) {
        e.deleteBuffer(this.vbo);
        this.vbo = null;
      }
      if (this.ibo) {
        e.deleteBuffer(this.ibo);
        this.ibo = null;
      }
      throw t;
    }
    this.vboSize = r;
    this.iboSize = i;
    this.vboFloatView = new Float32Array(this.vboData);
    this.vboUint8View = new Uint8Array(this.vboData);
    this.vboInt8View = new Int8Array(this.vboData);
    this.vboUint16View = new Uint16Array(this.vboData);
    this.vboInt16View = new Int16Array(this.vboData);
    this.iboUint16View = new Uint16Array(this.iboData);
  }
}
exports.default = a;