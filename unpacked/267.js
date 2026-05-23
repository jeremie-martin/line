var n = Math.ceil;
var r = Math.floor;
module.exports = function (e) {
  if (isNaN(e = +e)) {
    return 0;
  } else {
    return (e > 0 ? r : n)(e);
  }
};