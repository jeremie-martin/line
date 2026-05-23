module.exports = function (e) {
  if (typeof e == "object") {
    return e !== null;
  } else {
    return typeof e == "function";
  }
};