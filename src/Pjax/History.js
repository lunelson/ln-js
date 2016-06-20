/// HISTORY
var History = module.exports = {

  history: [],

  add: function(url, namespace) {
    if (!namespace)
      namespace = undefined;

    this.history.push({
      url: url,
      namespace: namespace
    });
  },

  currentStatus: function() {
    return this.history[this.history.length - 1];
  },

  prevStatus: function() {
    var history = this.history;

    if (history.length < 2)
      return null;

    return history[history.length - 2];
  }
};

