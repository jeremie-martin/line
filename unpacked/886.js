Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = u(require("./3.js"));
var i = u(require("./4.js"));
var o = u(require("./0.js"));
u(require("./1.js"));
var a = u(require("./5.js"));
var s = u(require("./2.js"));
var l = u(require("./19.js"));
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
      display: "flex",
      alignItems: "center",
      padding: e.spacing.unit * 2
    },
    avatar: {
      flex: "0 0 auto",
      marginRight: e.spacing.unit * 2
    },
    action: {
      flex: "0 0 auto",
      alignSelf: "flex-start",
      marginTop: e.spacing.unit * -1,
      marginRight: e.spacing.unit * -2
    },
    content: {
      flex: "1 1 auto"
    },
    title: {},
    subheader: {}
  };
};
function d(e) {
  var t = e.action;
  var n = e.avatar;
  var s = e.classes;
  var u = e.className;
  var c = e.component;
  var d = e.subheader;
  var f = e.title;
  var p = (0, i.default)(e, ["action", "avatar", "classes", "className", "component", "subheader", "title"]);
  return o.default.createElement(c, (0, r.default)({
    className: (0, a.default)(s.root, u)
  }, p), n && o.default.createElement("div", {
    className: s.avatar
  }, n), o.default.createElement("div", {
    className: s.content
  }, o.default.createElement(l.default, {
    type: n ? "body2" : "headline",
    component: "span",
    className: s.title
  }, f), d && o.default.createElement(l.default, {
    type: n ? "body2" : "body1",
    component: "span",
    color: "textSecondary",
    className: s.subheader
  }, d)), t && o.default.createElement("div", {
    className: s.action
  }, t));
}
d.propTypes = {};
d.defaultProps = {
  component: "div"
};
exports.default = (0, s.default)(c, {
  name: "MuiCardHeader"
})(d);