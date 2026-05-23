Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = u(require("./3.js"));
var i = u(require("./4.js"));
var o = u(require("./0.js"));
u(require("./1.js"));
var a = u(require("./925.js"));
var s = u(require("./2.js"));
var l = u(require("./63.js"));
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
      position: "relative",
      width: "100%"
    },
    select: {
      "-moz-appearance": "none",
      "-webkit-appearance": "none",
      userSelect: "none",
      paddingRight: e.spacing.unit * 4,
      width: "calc(100% - " + e.spacing.unit * 4 + "px)",
      minWidth: e.spacing.unit * 2,
      cursor: "pointer",
      "&:focus": {
        background: e.palette.type === "light" ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.05)",
        borderRadius: 0
      },
      "&:-moz-focusring": {
        color: "transparent",
        textShadow: "0 0 0 #000"
      },
      "&::-ms-expand": {
        display: "none"
      }
    },
    selectMenu: {
      width: "auto",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      overflow: "hidden",
      minHeight: "1.1875em",
      lineHeight: "1.1875em"
    },
    disabled: {
      cursor: "default"
    },
    icon: {
      position: "absolute",
      right: 0,
      top: "calc(50% - 12px)",
      color: e.palette.action.active,
      "pointer-events": "none"
    }
  };
};
function d(e) {
  var t = e.autoWidth;
  var n = e.children;
  var s = e.classes;
  var l = e.displayEmpty;
  var u = e.input;
  var c = e.inputProps;
  var d = e.MenuProps;
  var f = e.multiple;
  var p = e.native;
  var h = e.onClose;
  var m = e.onOpen;
  var y = e.open;
  var g = e.renderValue;
  var v = (0, i.default)(e, ["autoWidth", "children", "classes", "displayEmpty", "input", "inputProps", "MenuProps", "multiple", "native", "onClose", "onOpen", "open", "renderValue"]);
  return o.default.cloneElement(u, (0, r.default)({
    inputComponent: a.default
  }, v, {
    inputProps: (0, r.default)({}, c, u ? u.props.inputProps : {}, {
      autoWidth: t,
      children: n,
      classes: s,
      displayEmpty: l,
      MenuProps: d,
      multiple: f,
      native: p,
      onClose: h,
      onOpen: m,
      open: y,
      renderValue: g
    })
  }));
}
d.propTypes = {};
d.defaultProps = {
  autoWidth: false,
  displayEmpty: false,
  input: o.default.createElement(l.default, null),
  multiple: false,
  native: false
};
d.muiName = "Select";
exports.default = (0, s.default)(c, {
  name: "MuiSelect"
})(d);