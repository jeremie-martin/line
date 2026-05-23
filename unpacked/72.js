module.exports = function (e) {
  try {
    return !!e();
  } catch (e) {
    return true;
  }
};