var t = require("./18.js");
var r = require("./469.js");
function i(e) {
  this.audioContext = e;
  this.inlet = e.createChannelSplitter(2);
  this._pan = e.createGain();
  this.pan = this._pan.gain;
  this._wsL = e.createWaveShaper();
  this._wsR = e.createWaveShaper();
  this._L = e.createGain();
  this._R = e.createGain();
  this.outlet = e.createChannelMerger(2);
  this.inlet.channelCount = 2;
  this.inlet.channelCountMode = "explicit";
  this._pan.gain.value = 0;
  this._wsL.curve = r.L;
  this._wsR.curve = r.R;
  this._L.gain.value = 0;
  this._R.gain.value = 0;
  this.inlet.connect(this._L, 0);
  this.inlet.connect(this._R, 1);
  this._L.connect(this.outlet, 0, 0);
  this._R.connect(this.outlet, 0, 1);
  this._pan.connect(this._wsL);
  this._pan.connect(this._wsR);
  this._wsL.connect(this._L.gain);
  this._wsR.connect(this._R.gain);
  this._isConnected = false;
  this._dc1buffer = null;
  this._dc1 = null;
}
i.prototype.connect = function (e) {
  var n = this.audioContext;
  if (!this._isConnected) {
    this._isConnected = true;
    this._dc1buffer = n.createBuffer(1, 2, n.sampleRate);
    this._dc1buffer.getChannelData(0).set([1, 1]);
    this._dc1 = n.createBufferSource();
    this._dc1.buffer = this._dc1buffer;
    this._dc1.loop = true;
    this._dc1.start(n.currentTime);
    this._dc1.connect(this._pan);
  }
  t.AudioNode.prototype.connect.call(this.outlet, e);
};
i.prototype.disconnect = function () {
  var e = this.audioContext;
  if (this._isConnected) {
    this._isConnected = false;
    this._dc1.stop(e.currentTime);
    this._dc1.disconnect();
    this._dc1 = null;
    this._dc1buffer = null;
  }
  t.AudioNode.prototype.disconnect.call(this.outlet);
};
module.exports = i;