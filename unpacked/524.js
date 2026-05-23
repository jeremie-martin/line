Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = s(require("./104.js"));
var i = s(require("./293.js"));
var o = s(require("./203.js"));
var a = require("./204.js");
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = class {
  constructor() {
    this.entities = [];
    this.pointTypes = {};
    this.constraintTypes = {};
    this.entityTypes = {};
    this.index = 0;
    this.involvedLineIdsSet = new Set();
    this.involvedLineIds = [];
    this.partialIndex = 0;
    this._onCollide = this.onCollide.bind(this);
    this._onStep = this.onStep.bind(this);
  }
  setCurrentFrame(e) {
    this.index = e.snapshot.index;
    this.involvedLineIdsSet = new Set();
    this.involvedLineIds = [];
    this.partialIndex = 0;
    this.entities = [];
    e.snapshot.entities.forEach(e => {
      this.entities.push(this.createEntity(e, null));
    });
  }
  getNextFrame(e, t) {
    e.beginAccessTracking();
    this.index += 1;
    for (let r = 0; r < this.entities.length; ++r) {
      this.entities[r].step(t, this._onStep);
    }
    for (let r = 0; r < a.ITERATE; ++r) {
      for (let e = 0; e < this.entities.length; ++e) {
        this.entities[e].resolveIterables();
      }
      for (let t = 0; t < this.entities.length; ++t) {
        this.entities[t].handleCollisions(e, this._onCollide);
      }
    }
    for (let r = 0; r < this.entities.length; ++r) {
      this.entities[r].resolveNonIterables();
    }
    for (let r = 0; r < this.entities.length; ++r) {
      this.entities[r].endStep(t);
    }
    let n = {
      snapshot: this.getSnapshot(),
      involvedGridCells: e.endAccessTracking(),
      involvedLineIds: this.involvedLineIds,
      numPartialFrames: this.partialIndex
    };
    this.involvedLineIdsSet = new Set();
    this.involvedLineIds = [];
    this.partialIndex = 0;
    return n;
  }
  registerPointType(e, t) {
    if (t !== i.default && !(t.prototype instanceof i.default)) {
      throw new Error("points must inherit from PointBase");
    }
    if (this.pointTypes.hasOwnProperty(e)) {
      throw new Error("point type name is already taken");
    }
    this.pointTypes[e] = t;
  }
  registerConstraintType(e, t) {
    if (t !== o.default && !(t.prototype instanceof o.default)) {
      throw new Error("constraints must inherit from ConstraintBase");
    }
    if (this.constraintTypes.hasOwnProperty(e)) {
      throw new Error("constraint type name is already taken");
    }
    this.constraintTypes[e] = t;
  }
  registerEntityType(e, t) {
    if (t !== r.default && !(t.prototype instanceof r.default)) {
      throw new Error("entities must inherit from EntityBase");
    }
    if (this.entityTypes.hasOwnProperty(e)) {
      throw new Error("entity type name is already taken");
    }
    this.entityTypes[e] = t;
  }
  createEntity(e, t) {
    if (!e.type || !this.entityTypes[e.type]) {
      throw new Error("snapshotted entity type isnt a registered type: " + e.type);
    }
    return new this.entityTypes[e.type](e, t, this);
  }
  createPoint(e, t) {
    if (!e.type || !this.pointTypes[e.type]) {
      throw new Error("snapshotted point type isnt a registered type: " + e.type);
    }
    return new this.pointTypes[e.type](e, t, this);
  }
  createConstraint(e, t) {
    if (!e.type || !this.constraintTypes[e.type]) {
      throw new Error("snapshotted constraint type isnt a registered type: " + e.type);
    }
    return new this.constraintTypes[e.type](e, t, this);
  }
  getSnapshot() {
    return {
      index: this.index,
      entities: this.entities.map(e => e.getSnapshot())
    };
  }
  onCollide(e) {
    if (!this.involvedLineIdsSet.has(e.id)) {
      this.involvedLineIdsSet.add(e.id);
      this.involvedLineIds.push(e.id);
    }
    this.onPartial();
  }
  onStep(e) {
    this.onPartial();
  }
  onPartial() {
    this.partialIndex += 1;
  }
};
module.exports = exports.default;