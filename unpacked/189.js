module.exports = function (e) {
  if (e == undefined) {
    throw TypeError("Can't call method on  " + e);
  }
  return e;
};