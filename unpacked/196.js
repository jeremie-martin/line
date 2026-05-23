function r(e) {
  return function () {
    return e;
  };
}
function i() {}
i.thatReturns = r;
i.thatReturnsFalse = r(false);
i.thatReturnsTrue = r(true);
i.thatReturnsNull = r(null);
i.thatReturnsThis = function () {
  return this;
};
i.thatReturnsArgument = function (e) {
  return e;
};
module.exports = i;