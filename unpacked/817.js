Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = function (e) {
  if (e && e.__esModule) {
    return e;
  }
  var t = {};
  if (e != null) {
    for (var n in e) {
      if (Object.prototype.hasOwnProperty.call(e, n)) {
        t[n] = e[n];
      }
    }
  }
  t.default = e;
  return t;
}(require("./369.js"));
var i = s(require("./169.js"));
var o = s(require("./818.js"));
var a = s(require("./820.js"));
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = class {
  constructor(e) {
    var t = {
      premultipliedAlpha: true,
      alpha: false,
      antialias: false
    };
    const i = e.getContext("webgl", t) || e.getContext("experimental-webgl", t);
    this.gl = i;
    this.attributes = {};
    this.uniforms = {};
    this.unusedBuffers = [];
    this.spriteSheet = null;
    this.spriteImage = null;
    this.spriteTexture = null;
    this.backgroundRenderer = null;
    this.onionSkinEntityRenderer = null;
    this.foregroundRenderer = null;
    this.getBuffer = this.getBuffer.bind(this);
    this.returnBuffer = this.returnBuffer.bind(this);
    this.prog = r.loadProgram(this.gl, require("./821.js"), require("./822.js"));
    ["pos", "texPos", "alpha"].forEach(e => {
      this.attributes[e] = i.getAttribLocation(this.prog, e);
    });
    ["frameSize", "focalPoint", "zoom", "pixelDensity", "uSampler"].forEach(e => {
      this.uniforms[e] = i.getUniformLocation(this.prog, e);
    });
    i.enable(i.BLEND);
    i.enable(i.CULL_FACE);
    i.cullFace(i.BACK);
  }
  destroy() {
    this.gl = null;
  }
  render(e, t, n, r, i, s, l = {
    pixelDensity: this.pixelDensity,
    width: this.canvasWidth,
    height: this.canvasHeight,
    shouldUpdate: true
  }) {
    const u = this.gl;
    if (!r || !i) {
      return;
    }
    if (!this.spriteSheet || this.spriteSheet !== r) {
      this.spriteSheet = r;
      if (this.backgroundRenderer) {
        this.backgroundRenderer.destroy();
      }
      if (this.onionSkinEntityRenderer) {
        this.onionSkinEntityRenderer.destroy();
      }
      if (this.foregroundRenderer) {
        this.foregroundRenderer.destroy();
      }
      this.backgroundRenderer = new o.default(this.gl, this.attributes, this.spriteSheet, this.getBuffer, this.returnBuffer);
      this.onionSkinEntityRenderer = new a.default(this.gl, this.attributes, this.spriteSheet, this.getBuffer, this.returnBuffer, this.spriteSheet.mappings.rider.length);
      this.foregroundRenderer = new o.default(this.gl, this.attributes, this.spriteSheet, this.getBuffer, this.returnBuffer);
    }
    if (!this.spriteImage || this.spriteImage !== i) {
      this.spriteImage = i;
      if (this.spriteTexture != null) {
        u.deleteTexture(this.spriteTexture);
        this.spriteTexture = null;
      }
      this.spriteTexture = u.createTexture();
      u.bindTexture(u.TEXTURE_2D, this.spriteTexture);
      u.pixelStorei(u.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      for (let e = Math.min(u.getParameter(u.MAX_TEXTURE_SIZE), 2048), t = 0; Number.isInteger(e); e /= 2, t += 1) {
        if (t > 0 && (e === 1024 || e === 512)) {
          continue;
        }
        const n = document.createElement("canvas");
        const r = n.getContext("2d");
        n.width = e;
        n.height = e;
        r.clearRect(0, 0, e, e);
        r.drawImage(this.spriteImage, 0, 0, e, e);
        u.texImage2D(u.TEXTURE_2D, t, u.RGBA, u.RGBA, u.UNSIGNED_BYTE, n);
        if (t === 0) {
          u.generateMipmap(u.TEXTURE_2D);
        }
      }
      u.texParameteri(u.TEXTURE_2D, u.TEXTURE_WRAP_S, u.CLAMP_TO_EDGE);
      u.texParameteri(u.TEXTURE_2D, u.TEXTURE_WRAP_T, u.CLAMP_TO_EDGE);
      u.texParameteri(u.TEXTURE_2D, u.TEXTURE_MIN_FILTER, u.LINEAR_MIPMAP_LINEAR);
      u.texParameteri(u.TEXTURE_2D, u.TEXTURE_MAG_FILTER, u.LINEAR);
      u.bindTexture(u.TEXTURE_2D, null);
    }
    const c = {
      x: s.focalX,
      y: s.focalY
    };
    const d = s.zoom;
    const f = l.pixelDensity;
    if (l.shouldUpdate) {
      this._updateViewport(f);
    }
    u.blendFunc(u.ONE, u.ONE_MINUS_SRC_ALPHA);
    u.activeTexture(u.TEXTURE0);
    u.useProgram(this.prog);
    u.bindTexture(u.TEXTURE_2D, this.spriteTexture);
    u.uniform2f(this.uniforms.frameSize, l.width, l.height);
    u.uniform2f(this.uniforms.focalPoint, c.x, c.y);
    u.uniform1f(this.uniforms.zoom, d);
    u.uniform1f(this.uniforms.pixelDensity, f);
    u.uniform1i(this.uniforms.uSampler, 0);
    this.backgroundRenderer.render(e);
    this.onionSkinEntityRenderer.render(t);
    this.foregroundRenderer.render(n);
    u.bindTexture(u.TEXTURE_2D, null);
    u.useProgram(null);
  }
  getBuffer() {
    if (this.unusedBuffers.length > 0) {
      return this.unusedBuffers.pop();
    } else {
      return i.default.create(this.gl);
    }
  }
  returnBuffer(e) {
    this.unusedBuffers.push(e);
  }
};
module.exports = exports.default;