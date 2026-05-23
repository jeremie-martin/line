Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./521.js");
exports.default = class {
  constructor() {
    this._map = new Map();
  }
  get(e) {
    const t = (0, r.hashIntPair)(e.x, e.y);
    return this._map.get(t);
  }
  has(e) {
    const t = (0, r.hashIntPair)(e.x, e.y);
    return this._map.has(t);
  }
  set(e, t) {
    const n = (0, r.hashIntPair)(e.x, e.y);
    this._map.set(n, t);
  }
  delete(e) {
    const t = (0, r.hashIntPair)(e.x, e.y);
    this._map.delete(t);
  }
  values() {
    return this._map.values();
  }
};
module.exports = exports.default;