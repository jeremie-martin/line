function r(e, t) {
  return e.replace(new RegExp("(^|\\s)" + t + "(?:\\s|$)", "g"), "$1").replace(/\s+/g, " ").replace(/^\s*|\s*$/g, "");
}
module.exports = function (e, t) {
  if (e.classList) {
    e.classList.remove(t);
  } else if (typeof e.className == "string") {
    e.className = r(e.className, t);
  } else {
    e.setAttribute("class", r(e.className && e.className.baseVal || "", t));
  }
};