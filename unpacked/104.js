Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = class {
  constructor(e, t, n) {
    this.parent = t;
    this.type = e.type;
    this.entities = [];
    this.points = [];
    this.nonCollidingPoints = [];
    this.collidingPoints = [];
    this.constraints = [];
    this.iterableConstraints = [];
    this.nonIterableConstraints = [];
    this.pointLookup = {};
    if (e.entities) {
      if (!Array.isArray(e.entities)) {
        throw new Error("entities property must be an array");
      }
      e.entities.forEach(e => {
        this.addEntity(n.createEntity(e, this));
      });
    }
    if (e.points) {
      if (!Array.isArray(e.points)) {
        throw new Error("points property must be an array");
      }
      e.points.forEach(e => {
        this.addPoint(n.createPoint(e, this));
      });
    }
    if (e.constraints) {
      if (!Array.isArray(e.constraints)) {
        throw new Error("constraints property must be an array");
      }
      e.constraints.forEach(e => {
        this.addConstraint(n.createConstraint(e, this));
      });
    }
  }
  getSnapshot() {
    const e = [];
    const t = [];
    const n = [];
    for (let r = 0, i = this.entities.length; r < i; ++r) {
      e.push(this.entities[r].getSnapshot());
    }
    for (let r = 0, i = this.points.length; r < i; ++r) {
      t.push(this.points[r].getSnapshot());
    }
    for (let r = 0, i = this.constraints.length; r < i; ++r) {
      n.push(this.constraints[r].getSnapshot());
    }
    return {
      type: this.type,
      entities: e,
      points: t,
      constraints: n
    };
  }
  getPoint(e) {
    if (!e) {
      throw new Error("getPoint needs a name");
    }
    let t = this.pointLookup[e];
    if (!t) {
      throw new Error("unable to get a point with the name: " + e);
    }
    return t;
  }
  addEntity(e) {
    this.entities.push(e);
  }
  addPoint(e) {
    if (!e.name) {
      throw new Error("the given point has no name");
    }
    if (this.pointLookup.hasOwnProperty(e.name)) {
      throw new Error("this entity already has a point with the name: " + e.name);
    }
    this.points.push(e);
    this.pointLookup[e.name] = e;
    if (e.handleCollisions) {
      this.collidingPoints.push(e);
    } else {
      this.nonCollidingPoints.push(e);
    }
  }
  addConstraint(e) {
    this.constraints.push(e);
    if (e.constructor.iterating) {
      this.iterableConstraints.push(e);
    } else {
      this.nonIterableConstraints.push(e);
    }
  }
  step(e, t) {
    for (let n = 0, r = this.entities.length; n < r; ++n) {
      this.entities[n].step(e, t);
    }
    for (let n = 0, r = this.points.length; n < r; ++n) {
      let r = this.points[n];
      r.step(e);
      t(r);
    }
  }
  endStep(e) {
    for (let t = 0, n = this.entities.length; t < n; ++t) {
      this.entities[t].endStep(e);
    }
  }
  handleCollisions(e, t) {
    for (let n = 0, r = this.entities.length; n < r; ++n) {
      this.entities[n].handleCollisions(e, t);
    }
    for (let n = 0, r = this.collidingPoints.length; n < r; ++n) {
      this.collidingPoints[n].handleCollisions(e, t);
    }
  }
  resolveIterables() {
    for (let e = 0, t = this.entities.length; e < t; ++e) {
      this.entities[e].resolveIterables();
    }
    for (let e = 0, t = this.iterableConstraints.length; e < t; ++e) {
      this.iterableConstraints[e].resolve();
    }
  }
  resolveNonIterables() {
    for (let e = 0, t = this.entities.length; e < t; ++e) {
      this.entities[e].resolveNonIterables();
    }
    for (let e = 0, t = this.nonIterableConstraints.length; e < t; ++e) {
      this.nonIterableConstraints[e].resolve();
    }
  }
};
module.exports = exports.default;