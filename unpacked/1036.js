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
var i = m(require("./0.js"));
var o = require("./15.js");
var a = require("./17.js");
var s = m(require("./2.js"));
var l = require("./112.js");
var u = require("./306.js");
var c = require("./7.js");
var d = require("./198.js");
var f = require("./125.js");
var p = m(require("./90.js"));
var h = m(require("./259.js"));
require("./26.js");
function m(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const y = (0, a.createStructuredSelector)({
  inTrialMode: e => e.license.trial,
  autosaveActive: e => (0, l.getAutosaveEnabled)(e) && u.initAutosaveDirty
});
const g = {
  onLoadTrack: () => e => e((0, c.openTrackLoader)()),
  onPlay: () => e => {
    e((0, d.clearAutosave)());
    e((0, c.enterEditor)());
  },
  onLoadAutosave: () => async function (e) {
    await e((0, d.loadAutosave)());
    e((0, c.enterEditor)());
  },
  openReleaseNotes: c.openReleaseNotes,
  openAboutPage: c.openAboutPage
};
exports.default = (0, o.connect)(y, g)((0, s.default)(e => ({
  buttons: {
    margin: "0 auto",
    width: "100%",
    maxWidth: 460,
    textAlign: "center",
    display: "flex",
    justifyContent: "space-between"
  },
  buttons2: {
    margin: "0 auto",
    width: "100%",
    maxWidth: 420,
    display: "flex",
    justifyContent: "space-around"
  },
  apps: {
    display: "flex",
    justifyContent: "space-around",
    marginBottom: 16
  },
  "@media (max-width: 460px)": {
    buttons: {
      flexDirection: "column-reverse"
    },
    buttons2: {
      flexDirection: "column-reverse"
    }
  }
}))(class extends i.default.Component {
  constructor(e) {
    super(e);
    this.state = {
      disabled: false,
      pulsateRestorePurchases: false
    };
    this.onLoadAutosave = () => {
      this.setState({
        disabled: true
      });
      this.props.onLoadAutosave();
    };
    this.playButtonRef = null;
    this._onChildrenIn = this._onChildrenIn.bind(this);
  }
  componentWillUnmount() {}
  _onChildrenIn() {
    if (this.playButtonRef) {
      this.playButtonRef.focus();
    }
  }
  render() {
    var e = this.props;
    e.inTrialMode;
    let t = e.autosaveActive;
    let n = e.onLoadTrack;
    let o = e.onPlay;
    let a = e.classes;
    let s = function (e, t) {
      var n = {};
      for (var r in e) {
        if (!(t.indexOf(r) >= 0)) {
          if (Object.prototype.hasOwnProperty.call(e, r)) {
            n[r] = e[r];
          }
        }
      }
      return n;
    }(e, ["inTrialMode", "autosaveActive", "onLoadTrack", "onPlay", "classes"]);
    var l = this.state;
    let u = l.disabled;
    let d = l.pulsateRestorePurchases;
    return i.default.createElement(h.default, r({}, s, {
      onChildrenIn: this._onChildrenIn
    }), i.default.createElement("div", {
      className: a.apps
    }, i.default.createElement("a", {
      href: "https://play.google.com/store/apps/details?id=io.emergentstudios.linerider&pcampaignid=MKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1",
      style: {
        display: "inline-block",
        overflow: "hidden",
        background: "url(https://play.google.com/intl/en_us/badges/images/generic/en_badge_web_generic.png) no-repeat center center",
        backgroundSize: 155,
        width: 155,
        height: 50,
        margin: "-5px -10px"
      },
      alt: "Get it on Google Play"
    }), i.default.createElement("a", {
      href: "https://apps.apple.com/us/app/line-rider/id1475853607?itsct=apps_box_badge&itscg=30200",
      style: {
        display: "inline-block",
        overflow: "hidden",
        background: "url(https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83&amp;releaseDate=1565308800) no-repeat",
        width: 135,
        height: 40
      },
      alt: "Download on the App Store"
    })), i.default.createElement("div", {
      className: a.buttons
    }, t && i.default.createElement(f.Button, {
      color: "primary",
      onClick: this.onLoadAutosave,
      disabled: u,
      pulsating: !d
    }, "Load Autosave"), i.default.createElement(f.Button, {
      color: "primary",
      onClick: n,
      disabled: u
    }, "Load Track"), i.default.createElement(f.Button, {
      buttonRef: e => this.playButtonRef = e,
      color: "primary",
      onClick: o,
      pulsating: !t && !d,
      disabled: u
    }, "Play")), false, i.default.createElement(p.default, {
      id: c.LOAD_TRACK
    }));
  }
}));
module.exports = exports.default;