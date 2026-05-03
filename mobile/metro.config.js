const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force Metro to listen on all network interfaces (not just localhost)
// This allows physical devices on the same network to connect
config.server = {
  ...config.server,
  host: '0.0.0.0',
};

module.exports = config;
