Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = Object.assign || function (e) {
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
var o = require("./0.js");
var a = (r = o) && r.__esModule ? r : {
  default: r
};
var s = require("./15.js");
var l = require("./35.js");
exports.default = (0, s.connect)((e, {
  trigger: t
}) => ({
  triggerCount: (0, l.getTriggerCounts)(e, t)
}))(class extends a.default.Component {
  constructor(e) {
    super(e);
    this.state = {
      pressed: false
    };
    this.clicked = false;
    this.onClick = this.onClick.bind(this);
  }
  componentWillReceiveProps(e) {
    if (this.props.triggerCount !== e.triggerCount) {
      if (this.clicked) {
        this.clicked = false;
      } else {
        this.setState({
          pressed: true
        }, () => this.setState({
          pressed: false
        }));
      }
    }
  }
  onClick() {
    this.clicked = true;
    this.props.onSelect(this.props.trigger);
  }
  render() {
    var e = this.props;
    let t = e.disabled;
    let n = e.selected;
    let r = e.Button;
    e.triggerCount;
    e.dispatch;
    let o = e.selectedIcon;
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
    }(e, ["disabled", "selected", "Button", "triggerCount", "dispatch", "selectedIcon"]);
    if (n && o) {
      r = o.Button;
      n = false;
    }
    return a.default.createElement(r, i({}, s, {
      disabled: t,
      pressed: this.state.pressed,
      color: n ? "primary" : "",
      onClick: this.onClick
    }));
  }
});
module.exports = exports.default;