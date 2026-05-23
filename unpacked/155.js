exports.__esModule = true;
var r = a(require("./645.js"));
var i = a(require("./653.js"));
var o = typeof i.default == "function" && typeof r.default == "symbol" ? function (e) {
  return typeof e;
} : function (e) {
  if (e && typeof i.default == "function" && e.constructor === i.default && e !== i.default.prototype) {
    return "symbol";
  } else {
    return typeof e;
  }
};
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = typeof i.default == "function" && o(r.default) === "symbol" ? function (e) {
  if (e === undefined) {
    return "undefined";
  } else {
    return o(e);
  }
} : function (e) {
  if (e && typeof i.default == "function" && e.constructor === i.default && e !== i.default.prototype) {
    return "symbol";
  } else if (e === undefined) {
    return "undefined";
  } else {
    return o(e);
  }
};