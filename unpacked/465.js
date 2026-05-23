var e = require("./18.js");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.install = function (e) {
  if (e !== 0) {
    (function () {
      var e = new n(1, 1, 44100);
      var t = false;
      try {
        e.createGain().disconnect(e.destination);
      } catch (e) {
        t = true;
      }
      if (t) {
        return;
      }
      r.prototype.disconnect = function () {
        this._shim$connections = this._shim$connections || [];
        for (var e = arguments.length, t = Array(e), n = 0; n < e; n++) {
          t[n] = arguments[n];
        }
        var r;
        var s;
        if (t.length === 0) {
          a(this);
        } else if (t.length === 1 && typeof t[0] == "number") {
          r = this;
          s = t[0];
          o.call(r, s);
          r._shim$connections = r._shim$connections.filter(function (e) {
            return e[1] !== s;
          });
        } else {
          (function (e, t) {
            var n = [];
            var r = false;
            e._shim$connections.forEach(function (e) {
              r = r || t[0] === e[0];
              if (!function (e, t) {
                for (var n = 0, r = e.length; n < r; n++) {
                  if (e[n] !== t[n]) {
                    return false;
                  }
                }
                return true;
              }(t, e)) {
                n.push(e);
              }
            });
            if (!r) {
              throw new Error("Failed to execute 'disconnect' on 'AudioNode': the given destination is not connected.");
            }
            a(e);
            n.forEach(function (t) {
              i.call(e, t[0], t[1], t[2]);
            });
            e._shim$connections = n;
          })(this, t);
        }
      };
      r.prototype.disconnect.original = o;
      r.prototype.connect = function (e) {
        var t = arguments[1] === undefined ? 0 : arguments[1];
        var n = arguments[2] === undefined ? 0 : arguments[2];
        var o = undefined;
        this._shim$connections = this._shim$connections || [];
        if (e instanceof r) {
          i.call(this, e, t, n);
          o = n;
        } else {
          i.call(this, e, t);
          o = 0;
        }
        this._shim$connections.push([e, t, o]);
      };
      r.prototype.connect.original = i;
    })();
  }
};
var n = e.OfflineAudioContext;
var r = e.AudioNode;
var i = r.prototype.connect;
var o = r.prototype.disconnect;
function a(e) {
  for (var t = 0, n = e.numberOfOutputs; t < n; t++) {
    o.call(e, t);
  }
  e._shim$connections = [];
}