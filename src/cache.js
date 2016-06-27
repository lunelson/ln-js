//  _____            _
// /  __ \          | |
// | /  \/ __ _  ___| |__   ___
// | |    / _` |/ __| '_ \ / _ \
// | \__/\ (_| | (__| | | |  __/
//  \____/\__,_|\___|_| |_|\___|

class Cache {

  constructor() { this.reset(); this.active = true; }

  reset() { if (this.active) this.data = {}; }

  get(key) { return this.active ? (this.data[key] || null) : null; } // does this fail?

  set(key, val) { if (this.active) this.data[key] = val; return val; }

  get length() { return Object.keys(this.data).length; }
}

module.exports = Cache;