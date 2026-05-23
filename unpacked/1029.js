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
var i = a(require("./0.js"));
var o = a(require("./123.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = class extends i.default.Component {
  constructor(e) {
    super(e);
    this.delayInTimeout = null;
    this.delayOutTimeout = null;
    this.state = {
      in: false,
      nextIn: false,
      delay: 0
    };
  }
  static getDerivedStateFromProps(e, t) {
    if (e.in === t.in || e.in === t.nextIn) {
      return t;
    } else if (e.in) {
      return {
        in: false,
        nextIn: true,
        delay: e.delayIn || 0
      };
    } else {
      return {
        in: true,
        nextIn: false,
        delay: e.delayOut || 0
      };
    }
  }
  componentDidMount() {
    this._afterUpdate();
  }
  componentDidUpdate() {
    this._afterUpdate();
  }
  _afterUpdate() {
    if (this.state.nextIn !== this.state.in) {
      if (this.state.nextIn) {
        if (this.delayOutTimeout != null) {
          clearTimeout(this.delayOutTimeout);
          this.delayOutTimeout = null;
        }
        if (this.delayInTimeout == null) {
          this.delayInTimeout = setTimeout(() => {
            this.setState({
              in: true,
              nextIn: true,
              delay: 0
            });
          }, this.state.delay);
        }
      } else {
        if (this.delayInTimeout != null) {
          clearTimeout(this.delayInTimeout);
          this.delayInTimeout = null;
        }
        if (this.delayOutTimeout == null) {
          this.delayOutTimeout = setTimeout(() => {
            this.setState({
              in: false,
              nextIn: false,
              delay: 0
            });
          }, this.state.delay);
        }
      }
    }
  }
  componentWillUnmount() {
    if (this.delayOutTimeout != null) {
      clearTimeout(this.delayOutTimeout);
      this.delayOutTimeout = null;
    }
    if (this.delayInTimeout != null) {
      clearTimeout(this.delayInTimeout);
      this.delayInTimeout = null;
    }
  }
  render() {
    var e = this.props;
    e.delayIn;
    e.delayOut;
    const t = function (e, t) {
      var n = {};
      for (var r in e) {
        if (!(t.indexOf(r) >= 0)) {
          if (Object.prototype.hasOwnProperty.call(e, r)) {
            n[r] = e[r];
          }
        }
      }
      return n;
    }(e, ["delayIn", "delayOut"]);
    return i.default.createElement(o.default, r({}, t, {
      in: this.state.in
    }));
  }
};
module.exports = exports.default;