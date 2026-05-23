Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = f(require("./0.js"));
var i = require("./15.js");
var o = f(require("./2.js"));
var a = f(require("./88.js"));
var s = require("./17.js");
var l = require("./8.js");
var u = f(require("./60.js"));
var c = require("./22.js");
var d = require("./7.js");
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const p = [{
  name: "Quick Start",
  video: "1.quickstart.mp4"
}, {
  name: "Navigation",
  video: "2.navigation.mp4"
}, {
  name: "Line Types",
  video: "3.linetypes.mp4"
}, {
  name: "Pencil Tool",
  video: "4.1.pencil.mp4"
}, {
  name: "Line Tool",
  video: "4.2.line.mp4"
}, {
  name: "Eraser Tool",
  video: "4.3.eraser.mp4"
}, {
  name: "Selection Tool",
  video: "4.4.select.mp4"
}, {
  name: "Time Control",
  video: "5.1.timecontrol.mp4"
}, {
  name: "Checkpoint",
  video: "5.2.checkpoint.mp4"
}, {
  name: "Onion Skin",
  video: "5.3.onionskin.mp4"
}, {
  name: "Lines are one-sided",
  video: "6.1.onesided.mp4"
}, {
  name: "The rider is too fast",
  video: "6.2.fast.mp4"
}];
const h = (0, s.createStructuredSelector)({
  dimensions: l.getEditorDimensions
});
const m = {
  openTutorial: d.openTutorial
};
exports.default = (0, o.default)(e => ({
  root: {
    position: "fixed",
    width: "100%",
    height: "100%",
    transition: "background-color 300ms ease-in-out",
    backgroundColor: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    paddingLeft: 8,
    paddingRight: 8,
    textAlign: "center"
  },
  video: {
    border: "1px solid #eeeeee"
  },
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  videoContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  buttons: {
    display: "flex",
    alignSelf: "stretch",
    justifyContent: "space-between"
  },
  closeButton: {
    position: "absolute",
    top: 0,
    right: 0
  }
}))((0, i.connect)(h, m)(class extends r.default.PureComponent {
  render() {
    var e = this.props;
    const t = e.classes;
    const n = e.tutorial;
    const i = e.dimensions;
    const o = e.openTutorial;
    const s = n === -1;
    const l = p[Math.max(0, n)];
    const d = p[n - 1];
    const f = p[n + 1];
    const h = i.width < 688 || i.height < 480;
    let m = Math.min(640, i.width);
    let y = Math.min(480, i.height - 96);
    if (m / y < 4 / 3) {
      y = m / 4 * 3;
    } else {
      m = y * 4 / 3;
    }
    return r.default.createElement("div", {
      className: t.root
    }, r.default.createElement("div", {
      className: t.container,
      style: {
        position: !h && "relative"
      }
    }, r.default.createElement(c.Close.Button, {
      className: t.closeButton,
      onClick: () => o(null)
    }), r.default.createElement("div", {
      className: t.title
    }, r.default.createElement(a.default, {
      type: "display1"
    }, l.name)), r.default.createElement("div", {
      className: t.videoContainer
    }, r.default.createElement("video", {
      width: m,
      height: y,
      className: t.video,
      src: l.video,
      controls: true,
      autoPlay: true
    }), s ? r.default.createElement(u.default, {
      color: "primary",
      onClick: () => o(null)
    }, "Continue") : r.default.createElement("div", {
      className: t.buttons
    }, r.default.createElement(u.default, {
      size: "small",
      color: "primary",
      disabled: !d,
      onClick: () => o(n - 1),
      style: {
        textAlign: "left"
      }
    }, "< Previous", r.default.createElement("br", null), d && d.name), r.default.createElement(u.default, {
      size: "small",
      color: "primary",
      disabled: !f,
      onClick: () => o(n + 1),
      style: {
        textAlign: "right"
      }
    }, "Next >", r.default.createElement("br", null), f && f.name)))));
  }
}));
module.exports = exports.default;