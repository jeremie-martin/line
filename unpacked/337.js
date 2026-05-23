exports.__esModule = true;
exports.default = function (e) {
  if (typeof e == "string") {
    return e;
  } else if (e) {
    return e.displayName || e.name || "Component";
  } else {
    return undefined;
  }
};