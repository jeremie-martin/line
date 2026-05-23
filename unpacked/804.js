Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./363.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
const a = () => {};
exports.default = class {
  constructor(e) {
    this.target = e;
    this.onKeyChange = a;
    this.pressed = new Set();
    this.ignoreForceKeyUp = new Set();
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.target.addEventListener("keydown", this.handleKeyDown);
    this.target.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("visibilitychange", this.handleVisibilityChange, false);
    window.addEventListener("mousemove", this.handleMouseMove, false);
    window.addEventListener("wheel", this.handleMouseMove, false);
  }
  subscribe(e) {
    this.onKeyChange = e;
  }
  detach() {
    this.target.removeEventListener("keydown", this.handleKeyDown);
    this.target.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("visibilitychange", this.handleVisibilityChange, false);
    window.removeEventListener("mousemove", this.handleMouseMove, false);
    window.removeEventListener("wheel", this.handleMouseMove, false);
  }
  shouldIgnoreEvent(e) {
    let t = e.target || e.srcElement;
    let n = t.tagName.toLowerCase();
    return n === "input" || n === "select" || n === "textarea" || t.isContentEditable;
  }
  preventDefaultIfNeeded(e, t) {
    if (this.pressed.has("ctrl") || this.pressed.has("cmd")) {
      switch (t) {
        case "s":
        case "o":
        case "z":
        case "d":
        case "c":
        case "p":
          e.preventDefault();
          return false;
      }
    }
    switch (t) {
      case "backspace":
      case "space":
      case "enter":
      case "tab":
        e.preventDefault();
        return false;
    }
    if (this.pressed.has("alt")) {
      switch (t) {
        case "w":
        case "a":
        case "s":
        case "d":
        case "f":
        case "1":
        case "2":
        case "3":
          e.preventDefault();
          return false;
      }
    }
  }
  handleKeyDown(e) {
    if (this.shouldIgnoreEvent(e)) {
      return;
    }
    let t = (0, o.default)(e.keyCode);
    switch (t) {
      case "shift":
      case "alt":
      case "ctrl":
      case "cmd":
        this.ignoreForceKeyUp.add(t);
        setTimeout(() => {
          this.ignoreForceKeyUp.delete(t);
        }, 100);
    }
    if (this.pressed.has("cmd")) {
      for (let n of [...this.pressed]) {
        switch (n) {
          case "shift":
          case "alt":
          case "ctrl":
          case "cmd":
            break;
          default:
            this.pressed.delete(n);
            this.onKeyChange({
              type: "keyUp",
              key: n
            });
        }
      }
    }
    if (!this.pressed.has(t)) {
      this.pressed.add(t);
      this.onKeyChange({
        type: "keyDown",
        key: t
      });
    }
    return this.preventDefaultIfNeeded(e, t);
  }
  handleKeyUp(e) {
    let t = (0, o.default)(e.keyCode);
    if (this.pressed.has(t)) {
      if (t === "cmd") {
        for (let e of [...this.pressed]) {
          switch (e) {
            case "shift":
            case "alt":
            case "ctrl":
            case "cmd":
              break;
            default:
              this.pressed.delete(e);
              this.onKeyChange({
                type: "keyUp",
                key: e
              });
          }
        }
      }
      this.pressed.delete(t);
      this.onKeyChange({
        type: "keyUp",
        key: t
      });
    }
    return this.preventDefaultIfNeeded(e, t);
  }
  handleVisibilityChange() {
    if (document.hidden) {
      for (let e of [...this.pressed]) {
        this.pressed.delete(e);
        this.onKeyChange({
          type: "keyUp",
          key: e
        });
      }
    }
  }
  handleMouseMove(e) {
    if (!e.shiftKey && this.pressed.has("shift")) {
      this.forceKeyUp("shift");
    }
    if (!e.altKey && this.pressed.has("alt")) {
      this.forceKeyUp("alt");
    }
    if (!e.ctrlKey && this.pressed.has("ctrl")) {
      this.forceKeyUp("ctrl");
    }
    if (!e.metaKey && this.pressed.has("cmd")) {
      this.forceKeyUp("cmd");
    }
  }
  forceKeyUp(e) {
    if (!this.ignoreForceKeyUp.has(e)) {
      this.pressed.delete(e);
      this.onKeyChange({
        type: "keyUp",
        key: e
      });
    }
  }
};
module.exports = exports.default;