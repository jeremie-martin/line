Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./372.js"));
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
exports.default = class {
  constructor(e, t, n, i, o) {
    this.gl = e;
    this.attributes = t;
    this.spriteSheet = n;
    this.getBuffer = i;
    this.returnBuffer = o;
    this.prevEntities = null;
    this.ranges = [new r.default(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)];
  }
  destroy() {
    for (let e of this.ranges) {
      if (e.buffer) {
        this.returnBuffer(e.buffer);
      }
    }
    this.prevEntities = null;
    this.ranges = [new r.default(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)];
  }
  render(e) {
    if (e != null && e.size() !== 0) {
      if (this.prevEntities !== e) {
        if (this.prevEntities && this.prevEntities.root === e.root) {
          this.prevEntities.compareTo(e).forEachPrimitive(e => {
            if (e instanceof i.default.ListPatches.Add) {
              this._getRange(e.value.zIndex).add(e.value, this.spriteSheet);
            } else {
              this._getRange(e.value.zIndex).remove(e.value);
            }
          });
        } else {
          for (let e of this.ranges) {
            if (e.buffer) {
              this.returnBuffer(e.buffer);
              e.buffer = null;
            }
          }
          this.ranges = [new r.default(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)];
          e.forEach((e, t) => this._getRange(t).add(e, this.spriteSheet));
        }
      }
      for (let e = 0; e < this.ranges.length; ++e) {
        const t = this.ranges[e].render(this.gl, this.attributes, this.getBuffer, this.spriteSheet);
        if (t) {
          this.ranges.splice(e + 1, 0, ...t);
        }
      }
      for (let e = 0; e < this.ranges.length; ++e) {
        if (this.ranges[e].entries.length === 0) {
          if (e === 0) {
            this.ranges[e + 1].beginIndex = this.ranges[e].beginIndex;
          } else {
            this.ranges[e - 1].endIndex = this.ranges[e].endIndex;
          }
          if (this.ranges[e].buffer) {
            this.returnBuffer(this.ranges[e].buffer);
            this.ranges[e].buffer = null;
          }
          this.ranges.splice(e, 1);
          e -= 1;
        }
      }
      this.prevEntities = e;
    } else if (this.prevEntities) {
      this.destroy();
    }
  }
  _getRange(e) {
    for (let t = 0; t < this.ranges.length; ++t) {
      if (e < this.ranges[t].endIndex) {
        return this.ranges[t];
      }
    }
    throw new Error("no range for z-index " + e);
  }
};
module.exports = exports.default;