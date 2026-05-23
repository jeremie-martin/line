Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./810.js"));
var i = o(require("./25.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
class a {
  static create(e) {
    return new a(e);
  }
  constructor(e) {
    this.ranges = [new r.default(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)];
    this.allocBuffer = e;
    this._boundGetBuffer = this._getBuffer.bind(this);
  }
  destroy(e) {
    this.ranges.forEach(t => {
      if (t.buffer) {
        e(t.buffer);
        t.buffer = null;
      }
    });
  }
  render(e, t, n, o, a, s) {
    if (o !== a) {
      if (o && o.entities.root === a.entities.root) {
        o.compareTo(a).forEachPrimitive(e => {
          if (e instanceof i.default.ListPatches.Add) {
            this._getRange(e.value.zIndex).add(e.value);
          } else {
            this._getRange(e.value.zIndex).remove(e.value);
          }
        });
      } else {
        this.destroy(n);
        this.ranges = [new r.default(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)];
        a.entities.forEach(e => this._getRange(e.zIndex).add(e));
      }
    }
    for (let r = 0; r < this.ranges.length; ++r) {
      const n = this.ranges[r].render(e, t, this._boundGetBuffer, s);
      if (n) {
        this.ranges.splice(r + 1, 0, ...n);
      }
    }
    for (let r = 0; r < this.ranges.length; ++r) {
      if (this.ranges[r].entries.length === 0) {
        if (r === 0) {
          if (this.ranges[r + 1]) {
            this.ranges[r + 1].beginIndex = this.ranges[r].beginIndex;
          }
        } else if (this.ranges[r - 1]) {
          this.ranges[r - 1].endIndex = this.ranges[r].endIndex;
        }
        if (this.ranges[r].buffer) {
          n(this.ranges[r].buffer);
          this.ranges[r].buffer = null;
        }
        this.ranges.splice(r, 1);
        r -= 1;
      }
    }
  }
  _getRange(e) {
    for (let t = 0; t < this.ranges.length; ++t) {
      if (e < this.ranges[t].endIndex) {
        return this.ranges[t];
      }
    }
    throw new Error("no range for zIndex " + e);
  }
  _getBuffer(e) {
    let t = this.allocBuffer();
    if (t) {
      return t;
    }
    if (this.ranges.indexOf(e) > 0) {
      for (let n = 0; n < this.ranges.length && this.ranges[n] !== e; ++n) {
        if (this.ranges[n].buffer) {
          t = this.ranges[n].buffer;
          this.ranges[n].buffer = null;
          return t;
        }
      }
    }
    for (let n = this.ranges.length - 1; n >= 0 && this.ranges[n] !== e; --n) {
      if (this.ranges[n].buffer) {
        t = this.ranges[n].buffer;
        this.ranges[n].buffer = null;
        return t;
      }
    }
    throw new Error("unable to get a buffer");
  }
}
exports.default = a;
module.exports = exports.default;