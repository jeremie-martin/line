var n = 0;
var r = Math.random();
module.exports = function (e) {
  return `Symbol(${e === undefined ? "" : e})_${(++n + r).toString(36)}`;
};