Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./520.js"));
a(require("./202.js"));
var i = a(require("./522.js"));
var o = a(require("./16.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const s = () => true;
exports.default = class {
  constructor(e) {
    this.gridSize = e;
    this.map = new r.default();
    this.trackingMap = null;
  }
  beginAccessTracking() {
    this.trackingMap = new r.default();
  }
  endAccessTracking() {
    if (!this.trackingMap) {
      throw new Error("access tracking was not begun");
    }
    let e = this.trackingMap;
    this.trackingMap = null;
    return e;
  }
  _getCell(e) {
    if (this.trackingMap) {
      this.trackingMap.set(e, e);
    }
    return this.map.get(e);
  }
  addLine(e) {
    this.getGridCellCoordsForLine(e).forEach(t => this._addLineToCell(e, t));
  }
  removeLine(e) {
    this.getGridCellCoordsForLine(e).forEach(t => this._removeLineFromCell(e, t));
  }
  getGridCellCoordsForLine(e) {
    throw new Error("this method needs to be implemented by subclasses");
  }
  getGridCellsNearPos(e) {
    let t = Math.floor(e.x / this.gridSize);
    let n = Math.floor(e.y / this.gridSize);
    let r = [];
    for (let i = -1; i <= 1; i++) {
      for (let e = -1; e <= 1; e++) {
        const a = this._getCell(new o.default({
          x: i + t,
          y: e + n
        }));
        if (a) {
          r.push(a);
        }
      }
    }
    return r;
  }
  getLinesNearPos(e) {
    let t = [];
    let n = this.getGridCellsNearPos(e);
    for (let r = 0, i = n.length; r < i; ++r) {
      let e = n[r];
      for (let n = e.lines.length - 1; n >= 0; --n) {
        t.push(e.lines[n]);
      }
    }
    return t;
  }
  getLinesApproximatelyInRect(e, t, n, r, i) {
    i = i || s;
    const a = Math.floor(e / this.gridSize) - 1;
    const l = Math.floor(t / this.gridSize) - 1;
    const u = Math.floor(n / this.gridSize) + 1;
    const c = Math.floor(r / this.gridSize) + 1;
    let d = new Set();
    let f = [];
    let p = new o.default({
      x: 0,
      y: 0
    });
    for (p.x = a; p.x <= u; ++p.x) {
      for (p.y = l; p.y <= c; ++p.y) {
        let e = this._getCell(p);
        if (e) {
          for (let t = 0, n = e.lines.length; t < n; ++t) {
            const n = e.lines[t];
            if (!d.has(n.id)) {
              d.add(n.id);
              if (i(n)) {
                f.push(n);
              }
            }
          }
        }
      }
    }
    return f;
  }
  _addLineToCell(e, t) {
    let n = this._getCell(t);
    if (!n) {
      n = new i.default();
      this.map.set(t, n);
    }
    n.addLine(e);
  }
  _removeLineFromCell(e, t) {
    let n = this._getCell(t);
    if (!n) {
      throw new Error("expected the cell to exist");
    }
    n.removeLine(e);
    if (n.empty()) {
      this.map.delete(t);
    }
  }
};
module.exports = exports.default;