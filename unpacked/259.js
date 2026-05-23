Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Copyright = exports.About = exports.Version = undefined;
var r = c(require("./0.js"));
var i = c(require("./2.js"));
var o = c(require("./19.js"));
var a = c(require("./1029.js"));
var s = c(require("./213.js"));
var l = c(require("./98.js"));
var u = c(require("./1030.js"));
function c(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = class extends r.default.PureComponent {
  render() {
    var e = this.props;
    let t = e.children;
    let n = e.onChildrenIn;
    let i = e.onEntered;
    let o = function (e, t) {
      var n = {};
      for (var r in e) {
        if (!(t.indexOf(r) >= 0)) {
          if (Object.prototype.hasOwnProperty.call(e, r)) {
            n[r] = e[r];
          }
        }
      }
      return n;
    }(e, ["children", "onChildrenIn", "onEntered"]);
    if (i) {
      let e = i;
      i = () => {
        e();
        n();
      };
    } else {
      i = n;
    }
    return r.default.createElement(l.default, {
      in: this.props.in,
      delay: 300
    }, r.default.createElement(h, o), r.default.createElement(a.default, {
      in: this.props.in,
      delayIn: 900,
      delayOut: 50,
      direction: "up",
      onEntered: n
    }, r.default.createElement("div", null, t)));
  }
};
const d = exports.Version = ({
  type: e,
  openReleaseNotes: t
}) => r.default.createElement(o.default, {
  type: e,
  gutterBottom: true,
  title: "production_browser_cold_latest"
}, "Version", " ", r.default.createElement("a", {
  style: {
    cursor: "pointer"
  },
  onClick: t
}, s.default));
const f = exports.About = ({
  type: e,
  openAboutPage: t
}) => r.default.createElement(o.default, {
  type: e,
  gutterBottom: true
}, r.default.createElement("a", {
  style: {
    cursor: "pointer"
  },
  onClick: t
}, "About"));
const p = exports.Copyright = ({
  type: e
}) => r.default.createElement(o.default, {
  type: e,
  gutterBottom: true
}, "© 2020 Boštjan Čadež. \"Line Rider\" is a registered trademark of Boštjan Čadež");
const h = (0, i.default)(e => ({
  logo: {
    margin: "0 auto",
    marginBottom: 16,
    width: "100%",
    maxWidth: "600px"
  },
  "@media (max-height: 320px)": {
    logo: {
      marginBottom: 0
    }
  },
  Entry: {
    margin: "0 auto",
    marginBottom: 16,
    textAlign: "center",
    "& span": {
      display: "inline-block"
    }
  },
  link: {
    cursor: "pointer"
  }
}))(class extends r.default.PureComponent {
  render() {
    var e = this.props;
    let t = e.classes;
    let n = e.openReleaseNotes;
    let i = e.openAboutPage;
    const o = this.props.in;
    const s = this.props.onExited;
    return r.default.createElement(r.default.Fragment, null, r.default.createElement(u.default, {
      in: o,
      className: t.logo
    }), r.default.createElement("div", {
      className: t.Entry
    }, r.default.createElement(a.default, {
      in: o,
      delayIn: 600,
      delayOut: 300,
      onExited: s,
      direction: "up"
    }, r.default.createElement(d, {
      type: "caption",
      openReleaseNotes: n
    })), r.default.createElement("br", null), r.default.createElement(a.default, {
      in: o,
      delayIn: 700,
      delayOut: 220,
      direction: "up"
    }, r.default.createElement("span", null, r.default.createElement(f, {
      type: "caption",
      openAboutPage: i
    }))), r.default.createElement("br", null), r.default.createElement(a.default, {
      in: o,
      delayIn: 800,
      delayOut: 110,
      direction: "up"
    }, r.default.createElement("span", null, r.default.createElement(p, {
      type: "caption"
    })))));
  }
});