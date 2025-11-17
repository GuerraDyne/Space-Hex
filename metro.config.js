const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix import.meta issues for web builds
config.resolver.platforms = ['web', 'native', 'ios', 'android'];

// Handle module resolution for dependencies that use import.meta
config.transformer.minifierConfig = {
  ...config.transformer.minifierConfig,
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

// Configure source map support
config.transformer.unstable_allowRequireContext = true;

// Handle assets and static files
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'mp3',
  'wav',
  'ogg',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp'
];

module.exports = config;