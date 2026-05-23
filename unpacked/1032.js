Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = d(require("./0.js"));
var i = require("./15.js");
var o = d(require("./19.js"));
var a = d(require("./2.js"));
d(require("./213.js"));
var s = d(require("./132.js"));
var l = function (e) {
  if (e && e.__esModule) {
    return e;
  }
  var t = {};
  if (e != null) {
    for (var n in e) {
      if (Object.prototype.hasOwnProperty.call(e, n)) {
        t[n] = e[n];
      }
    }
  }
  t.default = e;
  return t;
}(require("./22.js"));
var u = require("./48.js");
d(require("./60.js"));
var c = require("./7.js");
require("./26.js");
function d(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const f = {
  position: "relative",
  top: 6,
  marginTop: -12,
  display: "inline-block",
  borderRadius: "50%",
  width: 24,
  height: 24
};
const p = {
  openTutorial: c.openTutorial,
  openSettingsSidebar: c.openSettingsSidebar
};
const h = (e = 0) => new Promise(t => setTimeout(t, e));
l.Pan;
l.Magnify;
l.Play;
l.Stop;
l.Rewind;
l.FastForward;
l.FlagVariant;
l.SlowMotion;
l.OnionSkin;
l.Pencil;
l.Line;
l.Eraser;
l.Cursor;
l.Undo;
l.Redo;
l.Magnet;
l.AngleSnap;
l.AngleLock;
l.LineFlip;
l.Brush;
l.Copy;
l.Paste;
l.Delete;
exports.default = (0, i.connect)(null, p)((0, a.default)(e => ({
  icon: {
    position: "relative",
    top: 6,
    marginTop: -12
  },
  hotkey: {
    display: "flex",
    justifyContent: "space-between",
    fontFamily: "monospace",
    fontSize: e.typography.caption.fontSize,
    lineHeight: e.typography.caption.lineHeight,
    borderBottom: `1px solid ${e.palette.divider}`
  },
  list: {
    "& li": {
      marginTop: "0.9rem",
      marginBottom: "0.9rem"
    },
    "& ol": {
      marginBlockStart: 0,
      marginBlockEnd: 0,
      paddingInlineStart: "1em"
    }
  },
  colorSwatchBlue: Object.assign({}, f, {
    backgroundColor: u.blue[500]
  }),
  colorSwatchRed: Object.assign({}, f, {
    backgroundColor: u.red[500]
  }),
  colorSwatchGreen: Object.assign({}, f, {
    backgroundColor: u.green[500]
  })
}))(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    this.openTutorials = async function (e) {
      if (this.tutorialRef) {
        if (!this.tutorialRef.panelRef.state.expanded) {
          this.tutorialRef.panelRef.setState({
            expanded: true
          });
          await h(500);
        }
        const t = document.getElementById("tutorial-link-" + e.tutorial);
        t.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
        await h(500);
        t.style.textDecoration = "underline";
        await h(500);
        t.click();
        t.style.textDecoration = null;
      }
    }.bind(this);
    window.addEventListener("onboardtutorial", this.openTutorials);
  }
  componentWillUnmount() {
    window.removeEventListener("onboardtutorial", this.openTutorials);
  }
  render() {
    var e = this.props;
    e.openTutorial;
    let t = e.classes;
    return r.default.createElement("div", {
      className: t.list
    }, r.default.createElement(r.default.Fragment, null, r.default.createElement(s.default, {
      heading: "Quick Start",
      defaultExpanded: true
    }, r.default.createElement(o.default, {
      paragraph: true
    }, "With the pencil ", r.default.createElement(l.Pencil.Icon, {
      className: t.icon
    }), " ", "tool, draw a line from the top-left to the bottom-right."), r.default.createElement(o.default, {
      paragraph: true
    }, "After you finish drawing, press the play", " ", r.default.createElement(l.Play.Icon, {
      className: t.icon
    }), " button and watch the rider go."), r.default.createElement(o.default, {
      paragraph: true
    }, "When you feel the rider is finished, press the stop", " ", r.default.createElement(l.Stop.Icon, {
      className: t.icon
    }), " button."), r.default.createElement(o.default, {
      paragraph: true
    }, "Press the new ", r.default.createElement(l.File.Icon, {
      className: t.icon
    }), " ", "button to make a new track."), r.default.createElement(o.default, {
      gutterBottom: true
    }, "Note that the lines you draw are one-sided and have direction: Lines drawn from left to right act as the floor and lines drawn from right to left act as the ceiling. The rider collides on the black side and passes through the colored side."), r.default.createElement(o.default, null, "Hold shift to reverse line direction."))));
  }
}));
module.exports = exports.default;