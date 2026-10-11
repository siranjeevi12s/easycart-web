const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch workspace root for shared packages
config.watchFolders = [workspaceRoot];

// Let Metro resolve hoisted node_modules (root + workspace)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Force resolver to handle monorepo symlinks
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
