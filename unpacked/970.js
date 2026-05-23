module.exports = function (e) {
  return e != null && typeof e == "object" && Array.isArray(e) === false;
};