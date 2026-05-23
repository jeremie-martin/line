var n = /(-?\d*\.?\d+(?:e[-+]?\d+)?)\s*([a-zμ]*)/gi;
function r(e) {
  var t = 0;
  e.replace(n, function (e, n, i) {
    i = r[i] || r[i.toLowerCase().replace(/s$/, "")] || 1;
    t += parseFloat(n, 10) * i;
  });
  return t;
}
module.exports = r;
r.nanosecond = r.ns = 0.000001;
r.μs = r.microsecond = 0.001;
r.millisecond = r.ms = 1;
r.second = r.sec = r.s = r.ms * 1000;
r.minute = r.min = r.m = r.s * 60;
r.hour = r.hr = r.h = r.m * 60;
r.day = r.d = r.h * 24;
r.week = r.wk = r.w = r.d * 7;
r.month = r.d * 30.4375;
r.year = r.yr = r.y = r.d * 365.25;