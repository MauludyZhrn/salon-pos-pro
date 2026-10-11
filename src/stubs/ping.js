module.exports = {
  start: () => Promise.reject(new Error("Network ping disabled: BLE printer only")),
};
module.exports.default = module.exports;