Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = u(require("./3.js"));
var i = u(require("./6.js"));
var o = u(require("./4.js"));
var a = u(require("./0.js"));
u(require("./1.js"));
var s = u(require("./5.js"));
var l = u(require("./2.js"));
function u(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var c = exports.styles = function (e) {
  return {
    root: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 48,
      background: "rgba(0, 0, 0, 0.4)",
      display: "flex",
      alignItems: "center",
      fontFamily: e.typography.fontFamily
    },
    rootBottom: {
      bottom: 0
    },
    rootTop: {
      top: 0
    },
    rootWithSubtitle: {
      height: 68
    },
    titleWrap: {
      flexGrow: 1,
      marginLeft: e.mixins.gutters({}).paddingLeft,
      marginRight: e.mixins.gutters({}).paddingRight,
      color: e.palette.common.white,
      overflow: "hidden"
    },
    titleWrapActionLeft: {
      marginLeft: 0
    },
    titleWrapActionRight: {
      marginRight: 0
    },
    title: {
      fontSize: e.typography.pxToRem(16),
      lineHeight: "24px",
      textOverflow: "ellipsis",
      overflow: "hidden",
      whiteSpace: "nowrap"
    },
    subtitle: {
      fontSize: e.typography.pxToRem(12),
      lineHeight: 1,
      textOverflow: "ellipsis",
      overflow: "hidden",
      whiteSpace: "nowrap"
    },
    actionIconPositionLeft: {
      order: -1
    },
    childImg: {
      height: "100%",
      transform: "translateX(-50%)",
      position: "relative",
      left: "50%"
    }
  };
};
function d(e) {
  var t;
  var n;
  var l = e.actionIcon;
  var u = e.actionPosition;
  var c = e.classes;
  var d = e.className;
  var f = e.subtitle;
  var p = e.title;
  var h = e.titlePosition;
  var m = (0, o.default)(e, ["actionIcon", "actionPosition", "classes", "className", "subtitle", "title", "titlePosition"]);
  var y = l && u;
  var g = (0, s.default)(c.root, (t = {}, (0, i.default)(t, c.rootBottom, h === "bottom"), (0, i.default)(t, c.rootTop, h === "top"), (0, i.default)(t, c.rootWithSubtitle, f), t), d);
  var v = (0, s.default)(c.titleWrap, (n = {}, (0, i.default)(n, c.titleWrapActionLeft, y === "left"), (0, i.default)(n, c.titleWrapActionRight, y === "right"), n));
  return a.default.createElement("div", (0, r.default)({
    className: g
  }, m), a.default.createElement("div", {
    className: v
  }, a.default.createElement("div", {
    className: c.title
  }, p), f ? a.default.createElement("div", {
    className: c.subtitle
  }, f) : null), l ? a.default.createElement("div", {
    className: (0, s.default)((0, i.default)({}, c.actionIconPositionLeft, y === "left"))
  }, l) : null);
}
d.propTypes = {};
d.defaultProps = {
  actionPosition: "right",
  titlePosition: "bottom"
};
exports.default = (0, l.default)(c, {
  name: "MuiGridListTileBar"
})(d);