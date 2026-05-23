var t = require("./18.js");
var r = require("./468.js");
var i = t.AudioContext || t.webkitAudioContext;
function o(e) {
  var t = new r(e);
  Object.defineProperties(t.inlet, {
    pan: {
      value: t.pan,
      enumerable: true
    },
    connect: {
      value: function (e) {
        return t.connect(e);
      }
    },
    disconnect: {
      value: function () {
        return t.disconnect();
      }
    }
  });
  return t.inlet;
}
o.polyfill = function () {
  if (i && !i.prototype.hasOwnProperty("createStereoPanner")) {
    i.prototype.createStereoPanner = function () {
      return new o(this);
    };
  }
};
module.exports = o;