const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add network configuration for development
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;
