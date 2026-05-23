Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setupSprites = s;
exports.render = l;
var r = a(require("./64.js"));
var i = a(require("./240.js"));
var o = require("./206.js");
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
async function s(e) {
  let t = e.spriteSvg;
  let n = e.hq;
  if (t == null) {
    return null;
  }
  {
    let e = {
      mappings: t.mappings,
      width: t.width,
      mipmapLevels: 0,
      image: null
    };
    if (n) {
      e.image = t.image;
    } else {
      e.mipmapLevels = 4;
      e.image = await async function (e, t) {
        let n = document.createElement("canvas");
        n.width = e.width * 2 * (1 << t);
        n.height = e.height * (1 << t);
        let r = n.getContext("2d");
        let i = e.image;
        for (let o = 0; o <= t; o++) {
          let e = 1 << t - o;
          let a = n.width - e * i.width * 2;
          r.drawImage(i, 0, 0, i.width, i.height, a, 0, e * i.width, e * i.height);
        }
        return n;
      }(t, e.mipmapLevels);
    }
    return e;
  }
}
function l(e, t, n, i) {
  let a = t.w;
  let s = t.h;
  let l = t.x;
  let u = t.y;
  let c = t.z;
  let d = t.r;
  let f = l * (c *= d) - (a *= d) / 2;
  let p = u * c - (s *= d) / 2;
  e.setTransform(1, 0, 0, 1, 0, 0);
  e.clearRect(0, 0, a, s);
  let h = 1;
  let m = 0;
  if (n.mipmapLevels > 0) {
    let e = Math.floor(n.mipmapLevels - Math.min(n.mipmapLevels, Math.max(0, Math.log2(c))));
    h = 1 << n.mipmapLevels - e;
    m = n.image.width - h * n.width * 2;
  }
  for (let g of i) {
    let t = n.mappings[g.type];
    let i = g.alpha ?? 1;
    for (let a of t) {
      let t = (0, o.getMappingProps)(a, g.params);
      if (t.hidden) {
        continue;
      }
      if (t.opacity != null) {
        e.globalAlpha = i * t.opacity;
      } else if (e.globalAlpha !== i) {
        e.globalAlpha = i;
      }
      var y = t.coords;
      let s = y.bbox;
      let l = y.anchor;
      let u = g.points[a.anchor];
      e.setTransform(c, 0, 0, c, -f + u.x * c, -p + u.y * c);
      if (a.lookAt) {
        let t = g.points[a.lookAt];
        let n = new r.default(t).sub(u);
        e.rotate(n.angle());
        if (a.stretch) {
          e.scale(n.len() / (s.width - o.PADDING * 2), 1);
        }
      }
      if (t.transform) {
        e.transform(...t.transform);
      }
      e.translate(s.x - l.x, s.y - l.y);
      e.drawImage(n.image, h * s.x + m, h * s.y, h * s.width, h * s.height, 0, 0, s.width, s.height);
    }
  }
}
exports.default = class extends i.default {
  getName() {
    return "CanvasSpriteDisplay";
  }
  constructor(e) {
    super(e);
    this.state = {
      spriteSheet: null
    };
    this.mounted = false;
  }
  componentDidMount() {
    super.componentDidMount();
    this.mounted = true;
    this.setupSprites(this.props);
  }
  componentWillUnmount() {
    this.mounted = false;
  }
  async setupSprites(e) {
    if (!e) {
      return;
    }
    let t = await s(e);
    if (this.mounted) {
      this.setState({
        spriteSheet: t
      });
    }
  }
  componentWillReceiveProps(e) {
    if (this.props.spriteSvg !== e.spriteSvg || this.props.hq !== e.hq) {
      this.setupSprites(e);
    }
  }
  shouldRerender(e, t) {
    return this.state.spriteSheet !== t.spriteSheet || this.props.backgroundEntities !== t.backgroundEntities || this.props.onionSkinEntities !== t.onionSkinEntities || this.props.foregroundEntities !== t.foregroundEntities || this.props.hq !== e.hq;
  }
  renderCanvas(e, t) {
    var n = this.props;
    let r = n.backgroundEntities;
    let i = n.onionSkinEntities;
    let o = n.foregroundEntities;
    let a = this.state.spriteSheet;
    if (a) {
      l(e, t, a, function* (...e) {
        for (let t of e) {
          yield* t;
        }
      }(r, i, o));
    }
  }
};