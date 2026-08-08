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

// 4. Resolve ESM-style `./money.js` specifiers to the `.ts` source they mean.
//
// `@sharing/core` is standards-compliant ESM: TypeScript's `verbatimModuleSyntax`
// and Deno both require the explicit `.js` extension on relative imports, even
// though the file on disk is `.ts`. Metro doesn't implement that mapping, so it
// looks for a literal `money.js` and fails.
//
// Rewriting here keeps the source correct for tsc, vitest and the Supabase Edge
// Functions, instead of stripping the extensions and breaking those three to
// suit the bundler.
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;

  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return resolve(context, moduleName.slice(0, -3), platform);
    } catch {
      // Fall through — it really was a .js file.
    }
  }

  return resolve(context, moduleName, platform);
};

module.exports = config;
