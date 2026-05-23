Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.focusKeyPressed = l;
exports.detectKeyboardFocus = function e(t, n, r, o = 1) {
  t.keyboardFocusTimeout = setTimeout(function () {
    if (l() && (document.activeElement === n || (0, i.default)(n, document.activeElement))) {
      r();
    } else if (o < t.keyboardFocusMaxCheckTimes) {
      e(t, n, r, o + 1);
    }
  }, t.keyboardFocusCheckTime);
};
exports.listenForFocusKeys = function () {
  if (!s.listening) {
    (0, o.default)(window, "keyup", function (e) {
      if (function (e) {
        return u.indexOf((0, r.default)(e)) !== -1;
      }(e)) {
        s.focusKeyPressed = true;
      }
    });
    s.listening = true;
  }
};
var r = a(require("./91.js"));
a(require("./14.js"));
var i = a(require("./165.js"));
var o = a(require("./360.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var s = {
  listening: false,
  focusKeyPressed: false
};
function l(e) {
  if (e !== undefined) {
    s.focusKeyPressed = Boolean(e);
  }
  return s.focusKeyPressed;
}
var u = ["tab", "enter", "space", "esc", "up", "down", "left", "right"];