const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Printer lib imports react-native-ping for network printers. We only use BLE, so stub it.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-ping") {
    return { type: "sourceFile", filePath: path.resolve(__dirname, "src/stubs/ping.js") };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;