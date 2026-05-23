Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = y(require("./3.js"));
var i = y(require("./4.js"));
var o = y(require("./126.js"));
var a = y(require("./10.js"));
var s = y(require("./9.js"));
var l = y(require("./11.js"));
var u = y(require("./12.js"));
var c = y(require("./13.js"));
var d = y(require("./0.js"));
y(require("./1.js"));
var f = y(require("./5.js"));
var p = y(require("./44.js"));
var h = y(require("./56.js"));
var m = y(require("./2.js"));
function y(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var g = exports.styles = {
  root: {
    boxSizing: "border-box",
    flexShrink: 0
  },
  tile: {
    position: "relative",
    display: "block",
    height: "100%",
    overflow: "hidden"
  },
  imgFullHeight: {
    height: "100%",
    transform: "translateX(-50%)",
    position: "relative",
    left: "50%"
  },
  imgFullWidth: {
    width: "100%",
    position: "relative",
    transform: "translateY(-50%)",
    top: "50%"
  }
};
var v = function (e) {
  function t() {
    var e;
    var n;
    var r;
    var i;
    (0, s.default)(this, t);
    for (var l = arguments.length, c = Array(l), d = 0; d < l; d++) {
      c[d] = arguments[d];
    }
    n = r = (0, u.default)(this, (e = t.__proto__ || (0, a.default)(t)).call.apply(e, [this].concat(c)));
    r.imgElement = null;
    r.handleResize = (0, h.default)(function () {
      r.fit();
    }, 166);
    r.fit = function () {
      var e = r.imgElement;
      if (e && e.complete) {
        var t;
        var n;
        var i;
        var a;
        if (e.width / e.height > e.parentNode.offsetWidth / e.parentNode.offsetHeight) {
          (t = e.classList).remove.apply(t, (0, o.default)(r.props.classes.imgFullWidth.split(" ")));
          (n = e.classList).add.apply(n, (0, o.default)(r.props.classes.imgFullHeight.split(" ")));
        } else {
          (i = e.classList).remove.apply(i, (0, o.default)(r.props.classes.imgFullHeight.split(" ")));
          (a = e.classList).add.apply(a, (0, o.default)(r.props.classes.imgFullWidth.split(" ")));
        }
        e.removeEventListener("load", r.fit);
      }
    };
    i = n;
    return (0, u.default)(r, i);
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "componentDidMount",
    value: function () {
      this.ensureImageCover();
    }
  }, {
    key: "componentDidUpdate",
    value: function () {
      this.ensureImageCover();
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      this.handleResize.cancel();
    }
  }, {
    key: "ensureImageCover",
    value: function () {
      if (this.imgElement) {
        if (this.imgElement.complete) {
          this.fit();
        } else {
          this.imgElement.addEventListener("load", this.fit);
        }
      }
    }
  }, {
    key: "render",
    value: function () {
      var e = this;
      var t = this.props;
      var n = t.children;
      var o = t.classes;
      var a = t.className;
      t.cols;
      var s = t.component;
      t.rows;
      var l = (0, i.default)(t, ["children", "classes", "className", "cols", "component", "rows"]);
      return d.default.createElement(s, (0, r.default)({
        className: (0, f.default)(o.root, a)
      }, l), d.default.createElement(p.default, {
        target: "window",
        onResize: this.handleResize
      }), d.default.createElement("div", {
        className: o.tile
      }, d.default.Children.map(n, function (t) {
        if (t.type === "img") {
          return d.default.cloneElement(t, {
            key: "img",
            ref: function (t) {
              e.imgElement = t;
            }
          });
        } else {
          return t;
        }
      })));
    }
  }]);
  return t;
}(d.default.Component);
v.propTypes = {};
v.defaultProps = {
  cols: 1,
  component: "li",
  rows: 1
};
exports.default = (0, m.default)(g, {
  name: "MuiGridListTile"
})(v);