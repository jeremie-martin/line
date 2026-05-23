Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = Object.assign || function (e) {
  for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t];
    for (var r in n) {
      if (Object.prototype.hasOwnProperty.call(n, r)) {
        e[r] = n[r];
      }
    }
  }
  return e;
};
var i = u(require("./0.js"));
var o = u(require("./1068.js"));
var a = u(require("./2.js"));
var s = u(require("./19.js"));
var l = u(require("./170.js"));
function u(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const c = {
  disableClick: true,
  disablePreview: true,
  multiple: false,
  style: {}
};
exports.default = (0, a.default)(e => ({
  overlay: {
    position: "fixed",
    width: "100%",
    height: "100%",
    backgroundColor: e.palette.action.hover,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }
}))(class extends i.default.PureComponent {
  constructor(e) {
    super(e);
    this.state = {
      active: false
    };
    this.onDrop = ([e]) => {
      if (e) {
        this.props.onFileDrop(e);
      }
      clearTimeout(this.dragOverTimer);
      this.setState({
        active: false
      });
    };
    this.onDragEnter = () => this.setState({
      active: true
    });
    this.onDragLeave = () => {
      clearTimeout(this.dragOverTimer);
      this.setState({
        active: false
      });
    };
    this.onDragOver = () => {
      clearTimeout(this.dragOverTimer);
      this.dragOverTimer = setTimeout(() => {
        this.setState({
          active: false
        });
      }, 500);
    };
    this.setFileDropRef = e => {
      this.fileDrop = e;
    };
  }
  componentWillUnmount() {
    clearTimeout(this.dragOverTimer);
  }
  open() {
    this.fileDrop.open();
  }
  render() {
    var e = this.props;
    let t = e.children;
    let n = e.classes;
    return i.default.createElement(o.default, r({}, c, {
      ref: this.setFileDropRef,
      onDrop: this.onDrop,
      onDragEnter: this.onDragEnter,
      onDragLeave: this.onDragLeave,
      onDragOver: this.onDragOver
    }), t, i.default.createElement(l.default, null, this.state.active && i.default.createElement("div", {
      className: n.overlay
    }, i.default.createElement(s.default, {
      type: "display4",
      align: "center"
    }, "Drop file..."))));
  }
});
module.exports = exports.default;