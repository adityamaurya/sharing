// Metro config for an npm-workspaces monorepo.
// Straight from the Expo monorepo guide: Metro has to be told the workspace
// root exists, or it will not find `@sharing/core` and will not watch it for
// changes during development.
// https://docs.expo.dev/guides/monorepos/

const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole workspace so edits to packages/core hot-reload.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Don't walk up past the workspace root looking for packages.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
