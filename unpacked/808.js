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
var i = s(require("./207.js"));
var o = s(require("./809.js"));
var a = s(require("./169.js"));
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const l = 256;
let u = null;
let c = null;
class d {
  static isSupported() {
    if (u === null) {
      try {
        var e = {
          premultipliedAlpha: true,
          alpha: false,
          antialias: false
        };
        var t = document.createElement("canvas");
        var n = t.getContext("webgl", e) || t.getContext("experimental-webgl", e);
        u = n != null && n.getShaderPrecisionFormat(n.FRAGMENT_SHADER, n.HIGH_FLOAT).precision !== 0;
      } catch (e) {
        u = false;
      }
    }
    return u;
  }
  static isHardwareAccelerated() {
    if (c === null) {
      if (d.isSupported()) {
        try {
          var e = {
            premultipliedAlpha: true,
            alpha: false,
            antialias: false,
            failIfMajorPerformanceCaveat: true
          };
          var t = document.createElement("canvas");
          var n = t.getContext("webgl", e) || t.getContext("experimental-webgl", e);
          c = n != null;
        } catch (e) {
          c = false;
        }
      } else {
        c = false;
      }
    }
    return c;
  }
  constructor(e, t) {
    var n = {
      premultipliedAlpha: true,
      alpha: false,
      antialias: false
    };
    this.gl = t || e.getContext("webgl", n) || e.getContext("experimental-webgl", n);
    this.manuallySetCanvasSize = true;
    this.canvasWidth = null;
    this.canvasHeight = null;
    this.prevCanvasWidth = null;
    this.prevCanvasHeight = null;
    this.uniforms = {};
    this.attributes = {};
    this.pixelDensity = window.devicePixelRatio;
    this.prevScene = new i.default();
    this.layerRenderers = new Map();
    this.bufferFreeList = [];
    this.numBuffers = 0;
    this._boundGetBuffer = this._getBuffer.bind(this);
    this._boundReturnBuffer = this._returnBuffer.bind(this);
    this._setupWebGL();
  }
  updateCanvasSize(e, t) {
    if (e === undefined || t === undefined) {
      this.canvasWidth = this.gl.canvas.clientWidth;
      this.canvasHeight = this.gl.canvas.clientHeight;
    } else {
      this.canvasWidth = e;
      this.canvasHeight = t;
    }
  }
  makeArrayBuffer() {
    return new Uint8Array(this.gl.canvas.width * this.gl.canvas.height * 4);
  }
  getPixels(e = this.makeArrayBuffer(), t = this.makeArrayBuffer()) {
    const n = this.gl;
    let r = n.canvas.width;
    let i = n.canvas.height;
    n.readPixels(0, 0, r, i, n.RGBA, n.UNSIGNED_BYTE, t);
    const o = r * 4;
    for (let a = 0; a < i; a++) {
      let n = t.subarray(a * o, (a + 1) * o);
      e.set(n, (i - a - 1) * o);
    }
    return e;
  }
  updateBuffers(e, t = false) {
    const n = this.gl;
    let r = new Set(this.layerRenderers.keys());
    e.layers.forEach(e => {
      if (!this.layerRenderers.has(e.layerIndex)) {
        this.layerRenderers.set(e.layerIndex, o.default.create(this._boundGetBuffer));
      }
      const i = this.prevScene.getLayerOrNull(e.layerIndex);
      this.layerRenderers.get(e.layerIndex).render(n, this.attributes, this._boundReturnBuffer, i, e, t);
      r.delete(e.layerIndex);
    });
    for (let i of r) {
      this.layerRenderers.get(i).destroy(this._boundReturnBuffer);
      this.layerRenderers.delete(i);
    }
    this.prevScene = e;
  }
  render(e, t, n = {
    pixelDensity: this.pixelDensity,
    width: this.canvasWidth,
    height: this.canvasHeight,
    shouldUpdate: true,
    transparent: false
  }) {
    const r = this.gl;
    const i = r.canvas;
    const o = e.bgColor;
    const a = {
      x: t.focalX,
      y: t.focalY
    };
    const s = t.zoom;
    const l = n.pixelDensity;
    if (n.shouldUpdate) {
      this._updateViewport(l);
    }
    r.viewport(0, 0, i.width, i.height);
    if (!n.transparent) {
      r.clearColor(o.r / 255, o.g / 255, o.b / 255, o.a / 255);
      r.clear(r.COLOR_BUFFER_BIT);
    }
    if (window.glClearBroken) {
      r.useProgram(this._hack_clearProg);
      r.bindBuffer(r.ARRAY_BUFFER, this._hack_vbo);
      r.enableVertexAttribArray(this._hack_posAttrib);
      r.vertexAttribPointer(this._hack_posAttrib, 2, r.FLOAT, false, 8, 0);
      r.uniform4f(this._hack_clearColorUniform, o.r / 255, o.g / 255, o.b / 255, o.a / 255);
      r.drawArrays(r.TRIANGLES, 0, 3);
    }
    r.blendFunc(r.SRC_ALPHA, r.ONE_MINUS_SRC_ALPHA);
    r.useProgram(this.prog);
    r.uniform2f(this.uniforms.frameSize, n.width, n.height);
    r.uniform2f(this.uniforms.focalPoint, a.x, a.y);
    r.uniform1f(this.uniforms.zoom, s);
    r.uniform1f(this.uniforms.pixelDensity, l);
    this.updateBuffers(e, true);
    r.useProgram(null);
  }
  aspectRatio() {
    this._updateViewport(this.pixelDensity);
    return this.gl.canvas.width / this.gl.canvas.height;
  }
  _setupWebGL() {
    const e = this.gl;
    this.prog = r.loadProgram(this.gl, require("./812.js"), require("./813.js"));
    ["pos", "drpos", "radius", "norm", "colorA", "colorB", "baryUnitLengthNormalised", "baryIndex"].forEach(t => {
      this.attributes[t] = e.getAttribLocation(this.prog, t);
    });
    ["frameSize", "focalPoint", "zoom", "pixelDensity"].forEach(t => {
      this.uniforms[t] = e.getUniformLocation(this.prog, t);
    });
    if (window.glClearBroken) {
      this._hack_clearProg = r.loadProgram(this.gl, require("./814.js"), require("./815.js"));
      this._hack_posAttrib = e.getAttribLocation(this._hack_clearProg, "pos");
      this._hack_clearColorUniform = e.getUniformLocation(this._hack_clearProg, "clearColor");
      this._hack_vbo = e.createBuffer();
      e.bindBuffer(e.ARRAY_BUFFER, this._hack_vbo);
      let t = new Float32Array([-1, -1, 3, -1, -1, 3]);
      e.bufferData(e.ARRAY_BUFFER, t, e.STATIC_DRAW);
    }
    e.enable(e.BLEND);
    e.enable(e.CULL_FACE);
    e.cullFace(e.BACK);
  }
  _updateViewport(e) {
    const t = this.gl.canvas;
    if (!this.manuallySetCanvasSize) {
      this.updateCanvasSize();
    }
    if (this.prevCanvasWidth !== Math.round(this.canvasWidth * e) || this.prevCanvasHeight !== Math.round(this.canvasHeight * e)) {
      this.prevCanvasWidth = Math.round(this.canvasWidth * e);
      this.prevCanvasHeight = Math.round(this.canvasHeight * e);
      try {
        t.width = this.prevCanvasWidth;
        t.height = this.prevCanvasHeight;
      } catch (e) {
        setTimeout(() => {
          t.width = this.prevCanvasWidth;
          t.height = this.prevCanvasHeight;
        }, 0);
      }
    }
  }
  _getBuffer() {
    if (this.bufferFreeList.length > 0) {
      return this.bufferFreeList.pop();
    }
    if (this.numBuffers >= l) {
      return null;
    }
    const e = a.default.create(this.gl);
    if (e) {
      ++this.numBuffers;
    }
    return e;
  }
  _returnBuffer(e) {
    this.bufferFreeList.push(e);
  }
}
exports.default = d;
module.exports = exports.default;