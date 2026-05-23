Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SledState = exports.RiderState = exports.SLED_POINT_INDICES = undefined;
var r = o(require("./104.js"));
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
const a = exports.SLED_POINT_INDICES = [0, 1, 2, 3];
const s = i.default.from(0, 0);
function l(e, t) {
  if (e !== t) {
    const n = e.sledId;
    e.sledId = t.sledId;
    t.sledId = n;
    const r = e.sledState;
    e.sledState = t.sledState;
    t.sledState = r;
    for (let i of a) {
      const n = e.points[i];
      const r = t.points[i];
      s.set(n.pos);
      n.pos.set(r.pos);
      r.pos.set(s);
      s.set(n.prevPos);
      n.prevPos.set(r.prevPos);
      r.prevPos.set(s);
      s.set(n.vel);
      n.vel.set(r.vel);
      r.vel.set(s);
    }
  }
}
const u = exports.RiderState = {
  MOUNTED: "MOUNTED",
  DISMOUNTING: "DISMOUNTING",
  DISMOUNTED: "DISMOUNTED",
  REMOUNTING: "REMOUNTING"
};
const c = exports.SledState = {
  INTACT: "INTACT",
  BROKEN: "BROKEN"
};
exports.default = class extends r.default {
  constructor(e, t, n) {
    super(e, t, n);
    this.riderProps = e.riderProps;
    this.riderState = e.riderState;
    this.sledState = e.sledState;
    this.sledId = e.sledId;
    this.frameCounter = e.frameCounter;
  }
  getSnapshot() {
    const e = super.getSnapshot();
    e.riderProps = this.riderProps;
    e.riderState = this.riderState;
    e.sledState = this.sledState;
    e.sledId = this.sledId;
    e.frameCounter = this.frameCounter;
    e.riderMounted = this.riderMounted;
    e.sledIntact = this.sledIntact;
    e.framesSinceUnmount = this.framesSinceUnmount;
    e.framesSinceSledBreak = this.framesSinceSledBreak;
    e.framesSinceStringDetached = this.framesSinceStringDetached;
    return e;
  }
  endStep(e) {
    super.endStep(e);
    switch (this.riderState) {
      case u.MOUNTED:
        this.frameCounter++;
        break;
      case u.DISMOUNTING:
        this.frameCounter++;
        if (this.frameCounter >= this.riderProps.framesToDismounted) {
          this.riderState = u.DISMOUNTED;
          this.frameCounter = 0;
        }
        break;
      case u.DISMOUNTED:
        {
          let e = false;
          if (this.parent && this.parent.entities.length > 1) {
            for (let t of this.parent.entities) {
              if (t.sledAvailable && t.sledAvailable()) {
                l(this, t);
                if (e = this.handleDismounted()) {
                  break;
                }
                l(this, t);
              }
            }
          } else if (this.sledIntact) {
            e = this.handleDismounted();
          }
          if (!e) {
            this.frameCounter = 0;
          }
          break;
        }
      case u.REMOUNTING:
        if (this.canEnterState(u.MOUNTED)) {
          this.frameCounter++;
        } else {
          this.frameCounter = 0;
        }
        if (this.frameCounter >= this.riderProps.framesToMounted) {
          this.riderState = u.MOUNTED;
          this.frameCounter = 0;
        }
    }
  }
  handleDismounted() {
    return !!this.canEnterState(u.REMOUNTING) && (this.frameCounter++, this.frameCounter >= this.riderProps.framesToRemounting && (this.riderState = u.REMOUNTING, this.frameCounter = 0), true);
  }
  canEnterState(e) {
    for (let t of this.constraints) {
      if (t.shouldDismount && t.shouldDismount(undefined, e)) {
        return false;
      }
    }
    return true;
  }
  sledAvailable() {
    if (!this.sledIntact) {
      return false;
    }
    switch (this.riderState) {
      case u.MOUNTED:
      case u.REMOUNTING:
        return false;
    }
    return true;
  }
  get riderMounted() {
    return this.riderState === u.MOUNTED;
  }
  get sledIntact() {
    return this.sledState === c.INTACT;
  }
  get framesSinceUnmount() {
    switch (this.riderState) {
      case u.MOUNTED:
        return 0;
      case u.DISMOUNTING:
        return this.frameCounter + 1;
      case u.DISMOUNTED:
      case u.REMOUNTING:
        return 41;
    }
  }
  get framesSinceSledBreak() {
    if (this.sledIntact) {
      return 0;
    } else {
      return 1;
    }
  }
  get framesSinceStringDetached() {
    switch (this.riderState) {
      case u.MOUNTED:
      case u.REMOUNTING:
        return 0;
      case u.DISMOUNTING:
      case u.DISMOUNTED:
        return 1;
    }
  }
};