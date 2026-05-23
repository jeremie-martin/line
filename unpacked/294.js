Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./16.js"));
var i = o(require("./293.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const a = {
  x: 0,
  y: 0
};
exports.default = class extends i.default {
  constructor(e, t, n) {
    super(e, t, n);
    this.pos = new r.default(e.pos);
    this.prevPos = new r.default(e.prevPos || this.pos);
    this.vel = new r.default(e.vel || a);
    this.friction = e.friction || 0;
    this.airFriction = e.airFriction || 0;
  }
  getSnapshot() {
    return {
      type: this.type,
      name: this.name,
      pos: {
        x: this.pos.x,
        y: this.pos.y
      },
      prevPos: {
        x: this.prevPos.x,
        y: this.prevPos.y
      },
      vel: {
        x: this.vel.x,
        y: this.vel.y
      },
      friction: this.friction,
      airFriction: this.airFriction
    };
  }
  step({
    gravity: e
  }) {
    this.vel = new r.default(this.pos).sub(this.prevPos).mul(1 - this.airFriction).add(e);
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;
    this.pos.add(this.vel);
  }
};
module.exports = exports.default;