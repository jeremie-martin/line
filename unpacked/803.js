Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = m(require("./0.js"));
var i = require("./15.js");
var o = m(require("./2.js"));
var a = require("./7.js");
var s = require("./106.js");
var l = m(require("./804.js"));
var u = m(require("./364.js"));
var c = m(require("./826.js"));
var d = m(require("./828.js"));
var f = m(require("./829.js"));
var p = require("./8.js");
var h = require("./17.js");
function m(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const y = e => e.preventDefault();
const g = /iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const v = {
  root: Object.assign({
    overflow: "hidden",
    position: "absolute",
    width: "100%",
    height: "100%"
  }, g && {
    "@media (orientation: landscape)": {
      height: "calc(100% + 1px)"
    }
  }),
  eventBlocker: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    overflow: "hidden"
  }
};
const b = {
  ping: a.ping,
  keyDown: s.keyDown,
  keyUp: s.keyUp
};
exports.default = (0, i.connect)((0, h.createStructuredSelector)({
  controlsActive: p.getControlsActive
}), b)((0, o.default)(v)(class extends r.default.Component {
  constructor(e) {
    super(e);
    this.touched = false;
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.state = {
      blockingEvents: false
    };
  }
  onTouchEnd() {
    this.touched = true;
    this.props.ping("touch");
    if (this.state.blockingEvents) {
      setTimeout(() => this.setState({
        blockingEvents: false
      }), 1);
    }
  }
  onMouseUp() {
    if (this.state.blockingEvents) {
      setTimeout(() => this.setState({
        blockingEvents: false
      }), 1);
    }
  }
  onMouseMove() {
    if (this.touched) {
      this.touched = false;
    } else {
      this.props.ping("mouse");
    }
  }
  componentDidMount() {
    this.keys = new l.default(window.document);
    this.keys.subscribe(e => {
      if (e.type === "keyDown") {
        this.props.keyDown(e.key);
      } else if (e.type === "keyUp") {
        this.props.keyUp(e.key);
      }
    });
  }
  componentWillUnmount() {
    this.keys.detach();
    this.keys = null;
  }
  onPointerDown(e) {
    if (!this.props.controlsActive) {
      this.setState({
        blockingEvents: true
      });
    }
    this.props.ping(e.pointerType);
  }
  render() {
    let e = this.props.classes;
    return r.default.createElement("div", {
      className: e.root,
      onContextMenu: y,
      onMouseMove: this.onMouseMove,
      onTouchEnd: this.onTouchEnd,
      onMouseUp: this.onMouseUp
    }, r.default.createElement(u.default, null), r.default.createElement(d.default, null, r.default.createElement(c.default, {
      onPointerDown: this.onPointerDown
    })), r.default.createElement(f.default, null), this.state.blockingEvents && r.default.createElement("div", {
      className: e.eventBlocker
    }));
  }
}));
module.exports = exports.default;