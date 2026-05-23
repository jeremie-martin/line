module.exports = function (e) {
  if (typeof e != "function") {
    throw TypeError(e + " is not a function!");
  }
  return e;
};