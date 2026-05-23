var n = {}.toString;
module.exports = Array.isArray || function (e) {
  return n.call(e) == "[object Array]";
};