Object.defineProperty(exports, "__esModule", {
  value: true
});
class r {
  constructor() {
    this.shouldTryAgain = true;
  }
  async paste() {
    if (!this.handlePaste) {
      return;
    }
    let e = function (e) {
      try {
        let t = JSON.parse(e);
        let n = t;
        let r = undefined;
        if (typeof n == "object") {
          if ("lines" in t) {
            n = t.lines;
          }
          if ("layers" in t) {
            r = t.layers;
          }
        }
        for (let e of n) {
          delete e.id;
          let t = e.type;
          let n = e.x1;
          let r = e.y1;
          let i = e.x2;
          let o = e.y2;
          if (!Number.isInteger(t) || !Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(i) || !Number.isFinite(o)) {
            console.warn("invalid line", e);
            return;
          }
          switch (t) {
            case 0:
            case 1:
            case 2:
              break;
            default:
              return;
          }
        }
        return {
          lines: n,
          layers: r
        };
      } catch (e) {
        console.warn(e);
      }
    }(await navigator.clipboard.readText());
    this.handlePaste(e);
    this.handlePaste = null;
  }
  async copy(e, t, n) {
    let i;
    let o = JSON.stringify(e);
    let a = false;
    try {
      await navigator.clipboard.writeText(o);
      a = true;
    } catch (e) {
      console.warn(e);
    }
    if (a) {
      this.shouldTryAgain = true;
      i = r.Success;
    } else if (this.shouldTryAgain) {
      this.shouldTryAgain = false;
      i = r.TryAgain;
    } else {
      this.shouldTryAgain = true;
      i = r.Fail;
    }
    t(i, n);
  }
  getClipboard(e) {
    this.handlePaste = e;
  }
}
exports.default = r;
r.Success = "Success";
r.TryAgain = "TryAgain";
r.Fail = "Fail";
module.exports = exports.default;