var e = require("./195.js")(module);
e.exports = function () {
  var n = Date.now() + 120000 + Math.random() * 60000;
  var r = 100 + Math.random() * 101 | 0;
  function i() {}
  switch (window.location.hostname.split(".").slice(-2).join(".")) {
    case "linerider.io":
    case "linerider.com":
    case "official-linerider.com":
      break;
    default:
      if (Math.random() < 0.075) {
        var o = 0;
        i = function () {
          if (window.Date.now() > n && o++ > r) {
            i = function () {};
            window.document.body.innerHTML = "This website/app has been stolen, please go to <a href=\"https://www.linerider.com\">www.linerider.com</a> to play Line Rider.";
          }
        };
      }
      let t = new window.BroadcastChannel("oXCuREAw70");
      t.postMessage("BJDVZrwqTC");
      t.onmessage = r => {
        n += 120001;
        if (r.data === "BJDVZrwqTC") {
          t.postMessage("MKOOE7");
        }
      };
  }
  return function () {
    i();
  };
}();