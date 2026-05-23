Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./0.js"));
var i = o(require("./21.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const a = {
  width: "100%",
  height: "100%",
  position: "absolute",
  top: 0,
  left: 0
};
exports.default = class extends r.default.PureComponent {
  shouldRerender(e, t) {}
  handleDiff(e, t) {}
  renderCanvas(e, t) {}
  getName() {
    return "CanvasDisplay";
  }
  getRenderer(e) {
    return e.getContext("2d");
  }
  getPixels(e) {
    return this.renderer.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
  }
  getResolution() {
    return this.props.pixelRatio || window.devicePixelRatio || 1;
  }
  componentDidMount() {
    this.canvas = i.default.findDOMNode(this.refs.canvas);
    this.renderer = this.getRenderer(this.canvas);
    this.rerender();
  }
  componentDidUpdate(e, t) {
    if (this.shouldRerender(e, t)) {
      this.handleDiff(e, t);
      this.rerender();
    } else if (this.props.camera !== e.camera || this.props.dimensions !== e.dimensions || this.props.pixelRatio !== e.pixelRatio) {
      this.rerender();
    }
  }
  rerender() {
    var e = this.props.camera;
    var t = e.position;
    let n = t.x;
    let r = t.y;
    let i = e.zoom;
    var o = this.props.dimensions;
    let a = o.width;
    let s = o.height;
    let l = this.getResolution();
    this.renderCanvas(this.renderer, {
      w: a,
      h: s,
      x: n,
      y: r,
      z: i,
      r: l
    });
  }
  render() {
    let e = this.getResolution();
    var t = this.props.dimensions;
    let n = t.width;
    let i = t.height;
    return r.default.createElement("canvas", {
      style: a,
      width: n * e,
      height: i * e,
      ref: "canvas"
    });
  }
};
module.exports = exports.default;