Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = function () {
  return function (e, t) {
    if (Array.isArray(e)) {
      return e;
    }
    if (Symbol.iterator in Object(e)) {
      return function (e, t) {
        var n = [];
        var r = true;
        var i = false;
        var o = undefined;
        try {
          for (var a, s = e[Symbol.iterator](); !(r = (a = s.next()).done) && (n.push(a.value), !t || n.length !== t); r = true);
        } catch (e) {
          i = true;
          o = e;
        } finally {
          try {
            if (!r && s.return) {
              s.return();
            }
          } finally {
            if (i) {
              throw o;
            }
          }
        }
        return n;
      }(e, t);
    }
    throw new TypeError("Invalid attempt to destructure non-iterable instance");
  };
}();
exports.render = h;
exports.createInitialScenes = m;
var i = f(require("./0.js"));
var o = f(require("./168.js"));
var a = function (e) {
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
}(require("./816.js"));
var s = f(require("./25.js"));
var l = f(require("./817.js"));
var u = require("./81.js");
var c = require("./201.js");
var d = require("./142.js");
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function p(e) {
  let t = e && e.name.match(/^#[0-9a-fA-F]{6}/);
  return t && t[0];
}
function h(e, t, n, r = false) {
  let i = t.w;
  let a = t.h;
  let s = t.x;
  let l = t.y;
  let u = t.z;
  let c = t.r;
  let d = new o.default.Camera().withAspectRatio(i / a).withFocalPoint(s, l).withZoom(u);
  e.render(n, d, {
    pixelDensity: c,
    width: i,
    height: a,
    transparent: r
  });
}
function m(e, t = null) {
  let n = [];
  let r = [];
  const i = new Map();
  if (t) {
    t.forEach(e => {
      i.set(e.id, {
        edit: [],
        playback: []
      });
    });
  }
  e.forEach(e => {
    let o;
    let s = y(e.type);
    let l = e.layer || 0;
    if (t) {
      const e = t.findIndex(e => e.id === l);
      o = t.get(e);
    }
    const u = p(o);
    if (l === 0) {
      n.push.apply(n, s(e));
      r.push.apply(r, a.genPlaybackLinesForLine(e, u));
    } else {
      if (!i.has(l)) {
        i.set(l, {
          edit: [],
          playback: []
        });
      }
      var c = i.get(l);
      const t = c.edit;
      const n = c.playback;
      t.push.apply(t, s(e));
      n.push.apply(n, a.genPlaybackLinesForLine(e, u));
    }
  });
  return {
    edit: o.default.Scene.fromEntities(n),
    playback: o.default.Scene.fromEntities(r),
    layers: new Map([...i.entries()].map(([e, {
      edit: t,
      playback: n
    }]) => [e, {
      edit: o.default.Scene.fromEntities(t),
      playback: o.default.Scene.fromEntities(n)
    }]))
  };
}
function y(e) {
  switch (e) {
    case u.SOLID_LINE:
      return a.genEditorLinesForSolidLine;
    case u.ACC_LINE:
      return a.genEditorLinesForAccLine;
    case u.SCENERY_LINE:
      return a.genEditorLinesForSceneryLine;
    default:
      throw new Error("unknown line type");
  }
}
function g(e) {
  const t = [];
  e.forEach(e => {
    switch (e.type) {
      case u.SOLID_LINE:
      case u.ACC_LINE:
        t.push.apply(t, a.genLineHitbox(e));
    }
  });
  return o.default.Scene.fromEntities(t);
}
const v = new o.default.Scene();
const b = {
  width: "100%",
  height: "100%"
};
class _ extends i.default.PureComponent {
  constructor(e) {
    super(e);
    if (e.secondary) {
      Object.defineProperties(this, {
        editScene: {
          get: () => _.primary.editScene,
          set: () => {}
        },
        playbackScene: {
          get: () => _.primary.playbackScene,
          set: () => {}
        },
        hitboxScene: {
          get: () => _.primary.hitboxScene,
          set: () => {}
        },
        toolScene: {
          get: () => _.primary.toolScene,
          set: () => {}
        },
        sceneLayers: {
          get: () => _.primary.sceneLayers,
          set: () => {}
        }
      });
    } else {
      _.primary = this;
      let t = m(e.lines, e.layers);
      this.editScene = t.edit;
      this.playbackScene = t.playback;
      this.hitboxScene = g(e.lines);
      this.toolScene = new o.default.Scene();
      this.sceneLayers = t.layers;
    }
    this.canvas = null;
    this.editRenderer = null;
    this.playbackRenderer = null;
    this.hitboxRenderer = null;
    this.hittestRenderer = null;
    this.skeletonRenderer = null;
    this.skeletonsRenderer = null;
    this.toolRenderer = null;
    this.layerRenderers = new Map();
    this.spriteRenderers = [];
    this.onCanvasMount = e => {
      this.canvas = e;
      if (this.props.innerRef) {
        this.props.innerRef(e);
      }
    };
  }
  componentWillReceiveProps(e) {
    if (e.numRiders < this.props.numRiders) {
      this.spriteRenderers.length = e.numRiders;
    } else if (e.numRiders > this.props.numRiders) {
      for (let t = this.props.numRiders; t < e.numRiders; t++) {
        this.spriteRenderers.push(new l.default(this.canvas, this.bgRenderer.gl));
      }
    }
  }
  componentDidMount() {
    this.bgRenderer = new o.default.WebGL1Renderer(this.canvas);
    const e = this.bgRenderer.gl;
    this.editRenderer = new o.default.WebGL1Renderer(this.canvas, e);
    this.playbackRenderer = new o.default.WebGL1Renderer(this.canvas, e);
    this.hitboxRenderer = new o.default.WebGL1Renderer(this.canvas, e);
    this.hittestRenderer = new o.default.WebGL1Renderer(this.canvas, e);
    this.skeletonRenderer = new o.default.WebGL1Renderer(this.canvas, e);
    this.skeletonsRenderer = new o.default.WebGL1Renderer(this.canvas, e);
    this.toolRenderer = new o.default.WebGL1Renderer(this.canvas, e);
    for (let t of this.sceneLayers.keys()) {
      this.layerRenderers.set(t, {
        edit: new o.default.WebGL1Renderer(this.canvas, e),
        playback: new o.default.WebGL1Renderer(this.canvas, e)
      });
    }
    this.spriteRenderers = Array(this.props.numRiders).fill().map(() => new l.default(this.canvas, e));
    this.rerender();
  }
  componentWillUnmount() {
    for (let t of this.spriteRenderers) {
      t.destroy();
    }
    this.spriteRenderers = [];
    const e = this.canvas.getContext("webgl").getExtension("WEBGL_lose_context");
    if (e) {
      e.loseContext();
    }
  }
  handleDiff(e) {
    if (!e) {
      return;
    }
    if (this.prevPropsLines) {
      e = Object.assign({}, e, {
        lines: this.prevPropsLines
      });
      delete this.prevPropsLines;
    }
    let t = this.editScene;
    let n = this.playbackScene;
    let i = this.hitboxScene;
    let l = this.toolScene;
    let d = e.layers.compareTo(this.props.layers);
    let f = new Set();
    d.forEachPrimitive(e => {
      if (e instanceof c.Remove) {
        f.add(e.value.id);
      } else if (f.has(e.value.id)) {
        f.delete(e.value.id);
      } else {
        this.sceneLayers.set(e.value.id, {
          edit: new o.default.Scene(),
          playback: new o.default.Scene()
        });
        this.layerRenderers.set(e.value.id, {
          edit: new o.default.WebGL1Renderer(this.canvas),
          playback: new o.default.WebGL1Renderer(this.canvas)
        });
      }
    });
    for (let r of f) {
      this.sceneLayers.delete(r);
      this.layerRenderers.delete(r);
    }
    if (d instanceof c.Sequence && d.patches.length === 2 && d.patches[0] instanceof c.Remove && d.patches[1] instanceof c.Add) {
      var h = r(d.patches, 2);
      const e = h[0].value;
      const t = h[1].value;
      let i = p(e);
      let o = p(t);
      if (i !== o) {
        let e = this.sceneLayers.get(t.id);
        for (let r of this.props.lines) {
          if ((r.layer || 0) === t.id) {
            if (t.id === 0) {
              n = n.withEntitiesInZIndexRangeRemoved(r.id, r.id + 1);
              for (let e of a.genPlaybackLinesForLine(r, o)) {
                n = n.withEntityAdded(e);
              }
            } else {
              e.playback = e.playback.withEntitiesInZIndexRangeRemoved(r.id, r.id + 1);
              for (let t of a.genPlaybackLinesForLine(r, o)) {
                e.playback = e.playback.withEntityAdded(t);
              }
            }
          }
        }
      }
    }
    if (e.lines.root === this.props.lines.root) {
      e.lines.compareTo(this.props.lines).forEachPrimitive(e => {
        let r = e.value;
        let o = r.layer || 0;
        if (e instanceof s.default.ListPatches.Add) {
          let e = y(r.type);
          const s = this.props.layers.findIndex(e => e.id === o);
          const l = p(this.props.layers.get(s));
          if (o === 0) {
            for (let n of e(r)) {
              t = t.withEntityAdded(n);
            }
            for (let e of a.genPlaybackLinesForLine(r, l)) {
              n = n.withEntityAdded(e);
            }
          } else if (this.sceneLayers.has(o)) {
            let t = this.sceneLayers.get(o);
            for (let n of e(r)) {
              t.edit = t.edit.withEntityAdded(n);
            }
            for (let e of a.genPlaybackLinesForLine(r, l)) {
              t.playback = t.playback.withEntityAdded(e);
            }
          }
          switch (r.type) {
            case u.SOLID_LINE:
            case u.ACC_LINE:
              for (let e of a.genLineHitbox(r)) {
                i = i.withEntityAdded(e);
              }
          }
        } else {
          if (o === 0) {
            t = t.withEntitiesInZIndexRangeRemoved(r.id, r.id + 1);
            n = n.withEntitiesInZIndexRangeRemoved(r.id, r.id + 1);
          } else if (this.sceneLayers.has(o)) {
            let e = this.sceneLayers.get(o);
            e.edit = e.edit.withEntitiesInZIndexRangeRemoved(r.id, r.id + 1);
            e.playback = e.playback.withEntitiesInZIndexRangeRemoved(r.id, r.id + 1);
          }
          switch (r.type) {
            case u.SOLID_LINE:
            case u.ACC_LINE:
              i = i.withEntitiesInZIndexRangeRemoved(r.id, r.id + 1);
          }
        }
      });
    } else {
      const e = m(this.props.lines, this.props.layers);
      t = e.edit;
      n = e.playback;
      this.sceneLayers = e.layers;
      i = g(this.props.lines);
    }
    var v;
    var b;
    var _;
    if (e.toolSceneLayer) {
      l = l.withLayerRemoved(e.toolSceneLayer.layerIndex);
    }
    if (this.props.toolSceneLayer) {
      l = l.withLayerAdded(this.props.toolSceneLayer);
    }
    v = l;
    b = e.customEditScene;
    _ = this.props.customEditScene;
    b.layers.forEach(e => {
      v = v.withLayerRemoved(e.layerIndex);
    });
    _.layers.forEach(e => {
      v = v.withLayerAdded(e);
    });
    l = v;
    this.editScene = t;
    this.playbackScene = n;
    this.hitboxScene = i;
    this.toolScene = l;
  }
  componentDidUpdate(e, t) {
    this.handleDiff(e, t);
    this.rerender();
  }
  rerender() {
    var e = this.props.camera;
    var t = e.position;
    let n = t.x;
    let r = t.y;
    let i = e.zoom;
    var a = this.props.dimensions;
    let s = a.width;
    let l = a.height;
    let u = this.props.pixelRatio;
    const c = {
      w: s,
      h: l,
      x: n,
      y: r,
      z: i,
      r: u
    };
    h(this.bgRenderer, c, v);
    for (const o of this.props.layers.filter(e => e.type === d.LayerTypes.LAYER)) {
      const e = o.id;
      const t = o.folderId;
      let n;
      let r;
      let i;
      let a;
      let s = o.visible;
      try {
        if (window.getLayerVisibleAtTime) {
          s = window.getLayerVisibleAtTime(e, this.props.index);
          if (t !== -1) {
            s = s || window.getLayerVisibleAtTime(t, this.props.index);
          }
        }
      } catch (e) {
        console.error("[Layer Renderer]", e.message);
      }
      if (e === 0) {
        n = this.editRenderer;
        r = this.editScene;
        i = this.playbackRenderer;
        a = this.playbackScene;
      } else {
        const t = this.sceneLayers.get(e);
        const o = this.layerRenderers.get(e);
        n = o.edit;
        r = t.edit;
        i = o.playback;
        a = t.playback;
      }
      if (s && this.props.color) {
        h(n, c, r, true);
      } else {
        n.updateBuffers(r);
      }
      if (s && !this.props.color) {
        h(i, c, a, true);
      } else {
        i.updateBuffers(a);
      }
    }
    if (this.props.skeleton) {
      const e = this.props.entitiesArray[0].lineHitTest;
      if (e) {
        let t = o.default.Scene.fromEntities(e);
        h(this.hittestRenderer, c, t, true);
      }
    }
    if (this.props.skeleton) {
      h(this.hitboxRenderer, c, this.hitboxScene, true);
    }
    const f = new o.default.Camera().withAspectRatio(s / l).withFocalPoint(n, r).withZoom(i);
    const p = {
      pixelDensity: u,
      width: s,
      height: l
    };
    if (this.props.spriteSvg) {
      for (let e = this.props.entitiesArray.length - 1; e >= 0; e--) {
        var m = this.props.entitiesArray[e];
        let t = m.background;
        let n = m.onionSkin;
        let r = m.foreground;
        if (this.props.skeleton) {
          r.forEach(e => {
            e.alpha = 0.4;
          });
        }
        this.spriteRenderers[e].render(t, n, r, this.props.spriteSvg[e], this.props.spriteSvg[e] && this.props.spriteSvg[e].image, f, p);
        if (this.props.skeleton) {
          r.forEach(e => {
            e.alpha = 1;
          });
        }
      }
      if (!this.props.secondary) {
        h(this.toolRenderer, c, this.toolScene, true);
      }
      if (this.props.skeleton) {
        for (let e = this.props.entitiesArray.length - 1; e >= 0; e--) {
          var y = this.props.entitiesArray[e];
          let t = y.skeleton;
          const n = [];
          y.skeletons.forEach(e => {
            n.push(...e);
          });
          let r = o.default.Scene.fromEntities(n);
          h(this.skeletonsRenderer, c, r, true);
          {
            let e = o.default.Scene.fromEntities(t);
            h(this.skeletonRenderer, c, e, true);
          }
        }
      }
      if (window.onDisplayRender) {
        window.onDisplayRender();
      }
    }
  }
  render() {
    let e = this.props.pixelRatio;
    var t = this.props.dimensions;
    let n = t.width;
    let r = t.height;
    return i.default.createElement("canvas", {
      style: b,
      width: n * e,
      height: r * e,
      ref: this.onCanvasMount
    });
  }
}
exports.default = _;