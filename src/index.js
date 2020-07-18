/* eslint no-empty: ["error", { "allowEmptyCatch": true }] */
const http = require('http');
const { chmodSync } = require('fs');
const EventEmitter = require('events');
const { spawn } = require('child_process');

class RsPlayer extends EventEmitter {
  constructor(options) {
    super();
    this.playing = false;
    this.agent = http.Agent({ keepAlive: true, keepAliveMsecs: 1200 });
    const {
      path, args, port, interval,
    } = options;
    this.path = path;
    this.port = port || 19260;
    this.interval = interval || 1;
    this.args = [`--port=${this.port}`, ...(args || [])];
  }

  launch() {
    try { chmodSync(this.path, 0o755); } catch {}
    this.player = spawn(this.path, this.args);

    this.timer = setInterval(async () => {
      if (this.playing) {
        const pos = await this.state();
        if (pos.playing) {
          if (pos.empty) {
            this.emit('playback', pos.position);
          } else {
            this.playing = false;
            this.emit('end');
          }
        } else this.playing = false;
      }
    }, this.interval * 1000);
  }

  quit() {
    this.player.kill('SIGHUP');
    this.playing = false;
    clearInterval(this.timer);
  }

  request(path) {
    return new Promise((resolve, reject) => {
      http.get('http://127.0.0.1',
        { agent: this.agent, port: this.port, path }, (res) => {
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => resolve(body));
        }).on('error', reject);
    });
  }

  async load(uri) {
    try {
      const res = await this.request(`/load/${encodeURIComponent(uri)}`);
      if (res === 'true') {
        this.playing = true;
        this.emit('load');
        return true;
      }
    } catch {}
    return false;
  }

  async play() {
    if (!this.playing) {
      try {
        const res = await this.request('/play');
        if (res === 'true') {
          this.playing = true;
          this.emit('play');
          return true;
        }
      } catch {}
    }
    return false;
  }

  async pause() {
    if (this.playing) {
      try {
        const res = await this.request('/pause');
        if (res === 'true') {
          this.playing = false;
          this.emit('pause');
          return true;
        }
      } catch {}
    }
    return false;
  }

  async stop() {
    if (this.playing) {
      try {
        const res = await this.request('/stop');
        if (res === 'true') {
          this.playing = false;
          this.emit('stop');
          return true;
        }
      } catch {}
    }
    return false;
  }

  async volume() {
    try {
      const res = await this.request('/volume');
      if (res !== '') return parseInt(res, 10);
    } catch {}
    return 100;
  }

  async setVolume(level) {
    try {
      const res = await this.request(`/set_volume/${Math.floor(level)}`);
      if (res === 'true') return true;
    } catch {}
    return false;
  }

  async isPaused() {
    try {
      const res = await this.request('/is_paused');
      if (res === 'true') return true;
    } catch {}
    return false;
  }

  async empty() {
    try {
      const res = await this.request('/empty');
      if (res === 'true') return true;
    } catch {}
    return false;
  }

  async position() {
    try {
      const res = await this.request('/position');
      if (res !== '') return parseInt(res, 10);
    } catch {}
    return 0;
  }

  async state() {
    try {
      const res = await this.request('/state');
      if (res !== '') return JSON.parse(res);
    } catch {}
    return {};
  }
}

module.exports = RsPlayer;
