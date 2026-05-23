(function (e) {
  var t = null;
  var n = null;
  var r = "polyBC_";
  function i(e) {
    var t = "";
    var n = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var r = 0; r < (e || 5); r++) {
      t += n.charAt(Math.floor(Math.random() * n.length));
    }
    return t;
  }
  function o() {
    return new Date().getTime();
  }
  function a(a) {
    if (!e.localStorage) {
      throw new Error("localStorage not available");
    }
    var l = r + a;
    var u = t === null;
    this.channelId = l;
    n = n || i();
    (t = t || {})[l] = t[l] || [];
    t[l].push(this);
    this.name = l + "::::" + i() + o();
    if (u) {
      e.addEventListener("storage", s.bind(this), false);
    }
    return this;
  }
  function s(r) {
    var i = r.key;
    var o = r.newValue;
    var a = !o;
    var s = null;
    if (i.indexOf("eomBCmessage_") > -1 && !a) {
      try {
        s = JSON.parse(o);
      } catch (e) {
        throw new "Message conversion has resulted in an error."();
      }
      if (s.tabId !== n && s.channelId && t && t[s.channelId]) {
        var l = t[s.channelId];
        for (var u in l) {
          if (!l[u].closed && l[u].onmessage) {
            l[u].onmessage(s.message);
          }
        }
        e.localStorage.removeItem(i);
      }
    }
  }
  a.prototype.onmessage = function (e) {};
  a.prototype.postMessage = function (r) {
    if (t) {
      if (this.closed) {
        throw new "This BroadcastChannel is closed."();
      }
      var a = function (t) {
        return {
          timestamp: o(),
          isTrusted: true,
          target: null,
          currentTarget: null,
          data: t,
          bubbles: false,
          cancelable: false,
          defaultPrevented: false,
          lastEventId: "",
          origin: e.location.origin
        };
      }(r);
      var s = t[this.channelId] || [];
      for (var l in s) {
        if (!s[l].closed && s[l].name !== this.name) {
          if (s[l].onmessage) {
            s[l].onmessage(a);
          }
        }
      }
      var u = {
        channelId: this.channelId,
        bcId: this.name,
        tabId: n,
        message: a
      };
      try {
        var c = JSON.stringify(u);
        var d = "eomBCmessage_" + i() + "_" + this.channelId;
        e.localStorage.setItem(d, c);
      } catch (e) {
        throw new "Message conversion has resulted in an error."();
      }
      setTimeout(function () {
        e.localStorage.removeItem(d);
      }, 1000);
    }
  };
  a.prototype.close = function () {
    this.closed = true;
    var n = t[this.channelId].indexOf(this);
    if (n > -1) {
      t[this.channelId].splice(n, 1);
    }
    if (!t[this.channelId].length) {
      delete t[this.channelId];
    }
    if (function (e) {
      for (var t in e) {
        if (e.hasOwnProperty(t)) {
          return false;
        }
      }
      return true;
    }(t)) {
      e.removeEventListener("storage", s.bind(this));
    }
  };
  try {
    e.BroadcastChannel = e.BroadcastChannel || a;
  } catch (e) {
    console.warn(e);
  }
})(window.top);