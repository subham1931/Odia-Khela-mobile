const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const webRoot = path.resolve(projectRoot, '../odiakhela-web');
const engineRoot = path.resolve(webRoot, 'engine');

const config = getDefaultConfig(projectRoot);

// Share the pure TypeScript rules engine with the web app (no React/DOM).
config.watchFolders = [engineRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.extraNodeModules = {
  '@odiakhela/engine': engineRoot,
};

module.exports = config;
