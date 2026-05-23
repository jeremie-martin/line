Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ScreenListener = undefined;
exports.default = function (e) {
  return new o(e);
};
var r = require("./8.js");
var i = require("./7.js");
class o {
  constructor(e, t = window) {
    this.target = t;
    this.getState = e.getState;
    this.dispatch = e.dispatch;
    this.handleResize = this.handleResize.bind(this);
    this.handlePixelRatioChange = this.handlePixelRatioChange.bind(this);
    this.handleResize();
    this.handlePixelRatioChange();
    this.target.addEventListener("resize", this.handleResize);
  }
  handleResize() {
    var e = (0, r.getEditorDimensions)(this.getState());
    let t = e.width;
    let n = e.height;
    var o = this.target;
    let a = o.innerWidth;
    let s = o.innerHeight;
    const l = document.getElementById("content");
    if (l) {
      let e = l.getBoundingClientRect();
      a = e.right - e.left;
      s = e.bottom - e.top;
    }
    let u = this.target.devicePixelRatio || 1;
    if (!Number.isInteger(a * u)) {
      a = Math.floor(a * u) / u;
    }
    if (!Number.isInteger(s * u)) {
      s = Math.floor(s * u) / u;
    }
    if (!window.ignoreResize && a > 0 && s > 0 && (a !== t || s !== n)) {
      this.dispatch((0, i.resize)({
        width: a,
        height: s
      }));
    }
  }
  handlePixelRatioChange() {
    if (this.query) {
      this.query.removeListener(this.handlePixelRatioChange);
    }
    const e = this.target.devicePixelRatio || 1;
    this.query = this.target.matchMedia(`screen and (min-resolution: ${e - 0.001}dppx) and (max-resolution: ${e + 0.001}dppx)`);
    this.query.addListener(this.handlePixelRatioChange);
    if (!window.ignoreResize && e !== (0, r.getPixelRatio)(this.getState())) {
      this.dispatch((0, i.setPixelRatio)(e));
    }
  }
  detach() {
    this.target.removeEventListener("resize", this.handleResize);
    if (this.query) {
      this.query.removeListener(this.handlePixelRatioChange);
    }
  }
}
exports.ScreenListener = o;