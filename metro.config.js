const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const engineRoot = path.resolve(projectRoot, 'engine');

const config = getDefaultConfig(projectRoot);

// Pure TypeScript rules engine (vendored for EAS builds).
config.watchFolders = [engineRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.extraNodeModules = {
  '@odiakhela/engine': engineRoot,
};

module.exports = config;
