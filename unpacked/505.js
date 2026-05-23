Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./506.js"));
var i = o(require("./16.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const a = ["BUTT", "SHOULDER", "RHAND", "LHAND", "LFOOT", "RFOOT"];
function s(e) {
  let t = 0;
  let n = 0;
  e.forEach(e => {
    t += e.x;
    n += e.y;
  });
  return new i.default({
    x: t / e.length,
    y: n / e.length
  });
}
class l {
  constructor(e, t = new r.default(e)) {
    this.engine = t;
  }
  isLegacy() {
    return this.engine.props.legacy;
  }
  equals(e) {
    return !!e && !!(e instanceof l) && (this === e || this.engine.equals(e.engine));
  }
  deepEquals(e) {
    return !!e && !!(e instanceof l) && (this === e || this.engine.deepEquals(e.engine));
  }
  get start() {
    return {
      position: this.engine.state.riders[0].startPosition,
      velocity: this.engine.state.riders[0].startVelocity
    };
  }
  get linesList() {
    return this.engine.state.lines;
  }
  setStart(e) {
    return new l(null, this.engine.withRidersChanged([{
      startPosition: e,
      startVelocity: this.engine.state.riders[0].startVelocity
    }]));
  }
  setRiders(e) {
    return new l(null, this.engine.withRidersChanged(e));
  }
  setLayers(e) {
    return new l(null, this.engine.withLayers(e));
  }
  toJSON() {
    return {
      start: this.start,
      lines: this.engine.state.lines.toJS().map(e => e.toJSON())
    };
  }
  getFrame(e) {
    return this.engine.getFrame(e);
  }
  getLineCounts() {
    return this.engine.getLineCounts();
  }
  getGridSize() {
    return this.engine.getGridSize();
  }
  getChangeCount() {
    return this.engine.getChangeCount();
  }
  getRider(e, t = 0) {
    let n = this.engine.getFrame(e).snapshot.entities[0].entities[t];
    let r = n.points;
    let i = r.filter(e => a.indexOf(e.name) >= 0);
    const o = n.type === "RemountRider" || n.type === "RemountRider2" ? -1 : 0;
    return {
      position: s(i.map(e => e.pos)),
      velocity: s(i.map(e => e.vel)),
      get: e => e === "RIDER_MOUNTED" ? {
        framesSinceUnbind: n.framesSinceUnmount + o,
        isBinded: () => n.riderMounted
      } : e === "SLED_INTACT" ? {
        framesSinceUnbind: n.framesSinceSledBreak + o,
        isBinded: () => n.sledIntact
      } : r.find(t => t.name === e)
    };
  }
  getRawRider(e) {
    return this.engine.getFrame(e).snapshot.entities[0].entities[0];
  }
  getRawRiders(e) {
    return this.engine.getFrame(e).snapshot.entities[0].entities;
  }
  getLine(e) {
    let t = this.engine.state.lines.findIndexWithBinarySearch(e, e => e.id);
    if (t >= 0) {
      return this.engine.state.lines.get(t);
    } else {
      return null;
    }
  }
  getMaxLineID() {
    let e = this.engine.state.lines.size();
    if (e === 0) {
      return null;
    } else {
      return this.engine.state.lines.get(e - 1).id;
    }
  }
  getBoundingBox() {
    return this.engine.getBoundingBox();
  }
  addLine(e) {
    return new l(null, this.engine.withLineAdded(e));
  }
  addLines(e) {
    return new l(null, this.engine.withLinesAdded(e));
  }
  removeLine(e) {
    return new l(null, this.engine.withLineRemoved(e));
  }
  removeLines(e) {
    return new l(null, this.engine.withLinesRemoved(e));
  }
  selectLinesInRadius(e, t) {
    return this.engine.selectLinesInRadius(e, t);
  }
  selectLinesInRect(e) {
    return this.engine.selectLinesInRect(e);
  }
}
exports.default = l;
module.exports = exports.default;