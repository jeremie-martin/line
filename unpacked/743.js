var r = require("./31.js")("iterator");
var i = false;
try {
  var o = [7][r]();
  o.return = function () {
    i = true;
  };
  Array.from(o, function () {
    throw 2;
  });
} catch (e) {}
module.exports = function (e, t) {
  if (!t && !i) {
    return false;
  }
  var n = false;
  try {
    var o = [7];
    var a = o[r]();
    a.next = function () {
      return {
        done: n = true
      };
    };
    o[r] = function () {
      return a;
    };
    e(o);
  } catch (e) {}
  return n;
};