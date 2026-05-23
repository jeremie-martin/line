Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./202.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
const a = 16;
class s {
  constructor(e) {
    e = e || 0;
    this._chunkMap = e == 0 ? new o.default() : new s(e - 1);
    this._currentChunk = null;
    this._currentChunkLeft = null;
    this._currentChunkTop = null;
    this._currentChunkBottom = null;
    this._currentChunkRight = null;
  }
  get(e) {
    if (e.x < this._currentChunkLeft || e.x >= this._currentChunkRight || e.y < this._currentChunkTop || e.y >= this._currentChunkBottom) {
      this._loadChunk(e, false);
    }
    if (!this._currentChunk) {
      return;
    }
    const t = e.x - this._currentChunkLeft;
    const n = e.y - this._currentChunkTop;
    return this._currentChunk[n * a + t];
  }
  has(e) {
    return this.get(e) !== undefined;
  }
  set(e, t) {
    if (!this._currentChunk || e.x < this._currentChunkLeft || e.x >= this._currentChunkRight || e.y < this._currentChunkTop || e.y >= this._currentChunkBottom) {
      this._loadChunk(e, true);
    }
    const n = e.x - this._currentChunkLeft;
    const r = e.y - this._currentChunkTop;
    this._currentChunk[r * a + n] = t;
  }
  delete(e) {
    this.set(e, undefined);
  }
  *values() {
    for (let e of this._chunkMap.values()) {
      for (let t of e) {
        if (t !== undefined) {
          yield t;
        }
      }
    }
  }
  _getChunkCoords(e) {
    return {
      x: Math.floor(e.x / a),
      y: Math.floor(e.y / a)
    };
  }
  _loadChunk(e, t) {
    const n = this._getChunkCoords(e);
    let r = this._chunkMap.get(n);
    let i = true;
    if (!r) {
      if (t) {
        r = this._createChunk();
        this._chunkMap.set(n, r);
      } else {
        i = false;
      }
    }
    this._currentChunk = r;
    this._currentChunkLeft = n.x * a;
    this._currentChunkTop = n.y * a;
    this._currentChunkRight = this._currentChunkLeft + a;
    this._currentChunkBottom = this._currentChunkTop + a;
    return i;
  }
  _createChunk() {
    const e = a * a;
    const t = new Array(e);
    for (let n = 0; n < e; ++n) {
      t[n] = undefined;
    }
    return t;
  }
}
exports.default = s;
module.exports = exports.default;