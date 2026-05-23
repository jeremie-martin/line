Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.DEVELOPMENT = "development";
const i = exports.STAGING = "staging";
const o = exports.PRODUCTION = "production";
let a = r;
switch (window.location.hostname.split(".").slice(-2).join(".")) {
  case "linerider.io":
    a = i;
    break;
  case "linerider.com":
    a = o;
}
exports.default = a;