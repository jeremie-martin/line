Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mods = function (e = i, {
  type: t,
  payload: n
}) {
  switch (t) {
    case r.REGISTER_CUSTOM_SETTING:
      return Object.assign({}, e, {
        registeredSettings: [...e.registeredSettings, n].sort((e, t) => e.name.toUpperCase().localeCompare(t.name.toUpperCase())),
        enabled: Object.assign({}, e.enabled, {
          [n.name]: true
        })
      });
    case r.REGISTER_CUSTOM_TOOL:
      return Object.assign({}, e, {
        registeredTools: Object.assign({}, e.registeredTools, {
          [n.toolName]: {
            component: n.component,
            tool: n.tool,
            icon: n.icon
          }
        }),
        enabled: Object.assign({}, e.enabled, {
          [n.toolName]: true
        })
      });
    case r.TOGGLE_CUSTOM_SETTING:
      return Object.assign({}, e, {
        enabled: Object.assign({}, e.enabled, {
          [n]: !e.enabled[n]
        })
      });
    default:
      return e;
  }
};
var r = require("./7.js");
const i = {
  registeredSettings: [],
  registeredTools: {},
  enabled: {}
};