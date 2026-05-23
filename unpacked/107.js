Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./25.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
class a {
  constructor(e) {
    this.entities = new o.default.List();
    this.layerIndex = e;
  }
  __clone() {
    return Object.assign(new a(), {
      entities: this.entities,
      layerIndex: this.layerIndex
    });
  }
  boundingBox() {
    if (this.entities.size() === 0) {
      return {
        x: -1,
        y: -1,
        width: 2,
        height: 2
      };
    }
    var e = Number.MAX_VALUE;
    var t = Number.MAX_VALUE;
    var n = -Number.MAX_VALUE;
    var r = -Number.MAX_VALUE;
    this.entities.forEach(function (i) {
      var o = i.boundingBox();
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
    var t = this.entities.findInsertionIndexWithBinarySearch(e.zIndex, e => e.zIndex);
    if (t < this.entities.size() && this.entities.get(t).zIndex === e.zIndex) {
      throw new Error("entities cannot have identical z indices");
    }
    return Object.assign(this.__clone(), {
      entities: this.entities.withValueAdded(t, e)
    });
  }
  withEntitiesInZIndexRangeRemoved(e, t) {
    for (var n = this.entities.findInsertionIndexWithBinarySearch(e, e => e.zIndex); n > 0 && this.entities.get(n - 1).zIndex >= e;) {
      --n;
    }
    for (var r = this.entities; n < r.size() && r.get(n).zIndex < t;) {
      r = r.withValueRemoved(n);
    }
    return Object.assign(this.__clone(), {
      entities: r
    });
  }
  compareTo(e) {
    return this.entities.compareTo(e.entities, {
      ordered: true,
      comparison: function (e, t) {
        if (e.equals(t)) {
          return 0;
        } else if (e.zIndex === t.zIndex) {
          return null;
        } else {
          return e.zIndex - t.zIndex;
        }
      }
    });
  }
}
exports.default = a;
module.exports = exports.default;