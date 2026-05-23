Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = {};
let i = 0;
exports.default = class {
  constructor(e, t) {
    this._target = null;
    this._locked = false;
    this._changeCount = i++;
    if (t) {
      this.props = e;
      this.state = null;
      this._computed = null;
    } else {
      this.props = e || r;
      let t = this.getInitialStateAndComputed();
      this.state = t.state;
      this._computed = t.computed;
      if (this._computed === null) {
        throw new Error("Immo computed data cannot be null");
      }
    }
  }
  _lockComputed() {
    if (this._computed === null) {
      let e = [];
      let t = this;
      while (t._target) {
        e.push(t);
        t = t._target;
      }
      for (e.push(t); e.length > 1;) {
        let t = e.pop();
        let n = e[e.length - 1];
        if (t._locked || n._locked) {
          throw new Error("unable to get computed as another instance has it locked");
        }
        const r = t._lockComputed();
        t.updateComputed(r, t.state, n.state);
        t._unlockComputed();
        n._computed = r;
        t._computed = null;
        n._target = null;
        t._target = n;
      }
    }
    this._locked = true;
    return this._computed;
  }
  _unlockComputed() {
    this._locked = false;
  }
  useComputed(e) {
    const t = e(this._lockComputed());
    this._unlockComputed();
    return t;
  }
  withStateChanged(e) {
    let t = Object.assign({}, this.state, e);
    let n = new this.constructor(this.props, true);
    n.state = this.state;
    const r = this._lockComputed();
    this._unlockComputed();
    this._computed = null;
    this._target = n;
    n._computed = r;
    n._lockComputed();
    n.updateComputed(r, n.state, t);
    n._unlockComputed();
    n.state = t;
    return n;
  }
  getChangeCount() {
    return this._changeCount;
  }
  updateComputed(e) {}
  initStateAndComputed() {
    return {
      state: {},
      computed: {}
    };
  }
};
module.exports = exports.default;