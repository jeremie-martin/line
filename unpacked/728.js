Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = h(require("./0.js"));
var i = require("./15.js");
var o = h(require("./2.js"));
var a = require("./164.js");
var s = h(a);
var l = require("./48.js");
var u = require("./732.js");
var c = require("./29.js");
var d = require("./17.js");
var f = h(require("./90.js"));
var p = require("./22.js");
function h(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = (0, i.connect)((0, d.createStructuredSelector)({
  progressId: u.getNotificationProgressId,
  notification: u.getNotification,
  notificationsCount: u.getNotificationsCount
}), {
  hideNotification: c.hideNotification
})((0, o.default)(e => ({
  content: {
    color: e.palette.text.primary,
    backgroundColor: l.overlayBackground,
    [e.breakpoints.up("sm")]: {
      minWidth: 288,
      maxWidth: 568,
      borderRadius: 2
    }
  },
  anchorTopRight: {
    [e.breakpoints.up("sm")]: {
      left: "auto",
      top: e.spacing.unit * 3,
      right: e.spacing.unit * 3
    }
  }
}))(class extends r.default.Component {
  constructor(e) {
    super(e);
    this.state = {
      progressId: e.progressId,
      notification: e.notification,
      open: true
    };
    this.hideNotification = () => {
      clearTimeout(this.autoHideTimer);
      this.props.hideNotification(this.props.notification.message);
    };
  }
  componentWillReceiveProps(e) {
    if (this.props.notificationsCount !== e.notificationsCount) {
      clearTimeout(this.autoHideTimer);
      this.setState({
        open: false
      });
      this.resetTimer = setTimeout(() => {
        this.setState({
          progressId: e.progressId,
          notification: e.notification,
          open: true
        });
      }, 100);
    }
    if (!this.props.notification.open && e.notification.open) {
      this.setState({
        progressId: e.progressId,
        notification: e.notification
      });
    }
  }
  componentDidUpdate(e, t) {
    let n = e.notification.open && t.open;
    let r = this.props.notification.open && this.state.open;
    if (!n && r && this.props.notification.autoHide) {
      this.autoHideTimer = setTimeout(this.hideNotification, 2000);
    }
  }
  componentWillUnmount() {
    clearTimeout(this.resetTimer);
    clearTimeout(this.autoHideTimer);
  }
  render() {
    var e = this.props;
    let t = e.notification.open;
    let n = e.classes;
    var i = this.state;
    let o = i.progressId;
    let l = i.notification.message;
    return r.default.createElement(s.default, {
      classes: {
        anchorTopRight: n.anchorTopRight
      },
      open: t && this.state.open,
      anchorOrigin: {
        vertical: "top",
        horizontal: "right"
      }
    }, r.default.createElement(a.SnackbarContent, {
      classes: {
        root: n.content
      },
      message: l,
      action: o ? r.default.createElement(f.default, {
        circular: true,
        id: o,
        onClick: this.hideNotification
      }) : r.default.createElement(p.Close.Button, {
        onClick: this.hideNotification
      })
    }));
  }
}));
module.exports = exports.default;