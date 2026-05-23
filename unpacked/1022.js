module.exports = function (e) {
  var t;
  if (e.nodeName === "SELECT") {
    e.focus();
    t = e.value;
  } else if (e.nodeName === "INPUT" || e.nodeName === "TEXTAREA") {
    var n = e.hasAttribute("readonly");
    if (!n) {
      e.setAttribute("readonly", "");
    }
    e.select();
    e.setSelectionRange(0, e.value.length);
    if (!n) {
      e.removeAttribute("readonly");
    }
    t = e.value;
  } else {
    if (e.hasAttribute("contenteditable")) {
      e.focus();
    }
    var r = window.getSelection();
    var i = document.createRange();
    i.selectNodeContents(e);
    r.removeAllRanges();
    r.addRange(i);
    t = r.toString();
  }
  return t;
};