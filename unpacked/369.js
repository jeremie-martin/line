Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.loadProgram = function (e, t, n) {
  const r = e.createProgram();
  const i = (t, n) => {
    let i = e.createShader(t);
    e.shaderSource(i, n);
    e.compileShader(i);
    if (!e.getShaderParameter(i, e.COMPILE_STATUS)) {
      throw new Error("Could not compile shader:\n\n" + e.getShaderInfoLog(i));
    }
    e.attachShader(r, i);
  };
  i(e.VERTEX_SHADER, t);
  i(e.FRAGMENT_SHADER, n);
  e.linkProgram(r);
  if (!e.getProgramParameter(r, e.LINK_STATUS)) {
    throw new Error("Could not link the shader program!");
  }
  return r;
};