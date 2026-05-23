Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.getRegisteredSettings = e => e.mods.registeredSettings;
const i = exports.getRegisteredTools = e => e.mods.registeredTools;
const o = exports.getEnabled = e => e.mods.enabled;
exports.getEnabledSettings = e => {
  const t = o(e);
  return r(e).filter(e => t[e.name]);
};
exports.getEnabledTools = e => {
  const t = o(e);
  return Object.fromEntries(Object.entries(i(e)).filter(([e, n]) => t[e]));
};