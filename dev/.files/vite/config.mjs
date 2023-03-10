/**
 * Vite config file.
 *
 * Vite is not aware of this config file's location.
 *
 * @note PLEASE DO NOT EDIT THIS FILE!
 * @note This entire file will be updated automatically.
 * @note Instead of editing here, please review <https://github.com/clevercanyon/skeleton>.
 *
 * @see https://vitejs.dev/config/
 */
/* eslint-env es2021, node */

import _ from 'lodash';

import fs from 'node:fs';
import path from 'node:path';
import { dirname } from 'desm';
import fsp from 'node:fs/promises';
import archiver from 'archiver';

import { loadEnv } from 'vite';
import pluginBasicSSL from '@vitejs/plugin-basic-ssl';
import { ViteEjsPlugin as pluginEJS } from 'vite-plugin-ejs';
import { ViteMinifyPlugin as pluginMinifyHTML } from 'vite-plugin-minify';

import u from '../bin/includes/utilities.mjs';
import { $obj, $mm } from '@clevercanyon/utilities';
import { $glob } from '@clevercanyon/utilities.node';
import importAliases from './includes/aliases.mjs';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

/**
 * Defines Vite configuration.
 *
 * @param   vite Data passed in by Vite.
 *
 * @returns      Vite configuration object properties.
 */
export default async ({ mode, command /*, ssrBuild */ }) => {
	/**
	 * Directory vars.
	 */
	const __dirname = dirname(import.meta.url);
	const projDir = path.resolve(__dirname, '../../..');

	const srcDir = path.resolve(__dirname, '../../../src');
	const envsDir = path.resolve(__dirname, '../../../dev/.envs');
	const cargoDir = path.resolve(__dirname, '../../../src/cargo');

	const distDir = path.resolve(__dirname, '../../../dist');
	const a16sDir = path.resolve(__dirname, '../../../dist/assets/a16s');

	/**
	 * Package-related vars.
	 */
	const pkg = await u.pkg(); // Parses current `./package.json` file.

	/**
	 * Mode-related vars.
	 */
	const isDev = 'dev' === mode; // Development mode?
	process.env.NODE_ENV = isDev ? 'development' : 'production'; // <https://o5p.me/DscTVM>.

	/**
	 * Environment-related vars.
	 */
	const appEnvPrefix = 'APP_'; // Part of app.
	const env = loadEnv(mode, envsDir, appEnvPrefix);

	/**
	 * App type, target, path, and related vars.
	 */
	const appType = _.get(pkg, 'config.c10n.&.build.appType') || 'cma';
	const targetEnv = _.get(pkg, 'config.c10n.&.build.targetEnv') || 'any';
	const appBasePath = env.APP_BASE_PATH || ''; // From environment vars.

	const isMPA = 'mpa' === appType;
	const isCMA = 'cma' === appType || !isMPA;

	let cmaName = (pkg.name || '').toLowerCase();
	cmaName = cmaName.replace(/\bclevercanyon\b/gu, 'c10n');
	cmaName = cmaName.replace(/@/gu, '').replace(/\./gu, '-').replace(/\/+/gu, '.');
	cmaName = cmaName.replace(/[^a-z.0-9]([^.])/gu, (m0, m1) => m1.toUpperCase());
	cmaName = cmaName.replace(/^\.|\.$/u, '');

	const mpaIndexes = await $glob.promise('**/index.html', { cwd: srcDir });
	const mpaIndexesSubPaths = mpaIndexes.map((absPath) => path.relative(srcDir, absPath));

	const cmaEntries = await $glob.promise('*.{ts,tsx}', { cwd: srcDir });
	const cmaEntriesRelPaths = cmaEntries.map((absPath) => './' + path.relative(srcDir, absPath));
	const cmaEntriesSubpaths = cmaEntries.map((absPath) => path.relative(srcDir, absPath));
	const cmaEntriesSubpathsNoExt = cmaEntriesSubpaths.map((subpath) => subpath.replace(/\.[^.]+$/u, ''));

	const mpaEntryIndexSubpath = mpaIndexesSubPaths.find((subpath) => $mm.isMatch(subpath, 'index.html'));
	const cmaEntryIndexSubpath = cmaEntriesSubpaths.find((subpath) => $mm.isMatch(subpath, 'index.{ts,tsx}'));
	const cmaEntryIndexSubpathNoExt = cmaEntryIndexSubpath.replace(/\.[^.]+$/u, '');

	const isWeb = ['web', 'webw'].includes(targetEnv);
	const isSSR = ['cfp', 'cfw', 'node'].includes(targetEnv);
	const isSSRNoExternals = isSSR && ['cfp', 'cfw'].includes(targetEnv);
	const isSSRWorker = isSSR && ['cfw'].includes(targetEnv);

	/**
	 * Validates all of the above.
	 */
	if (!['dev', 'ci', 'stage', 'prod'].includes(mode)) {
		throw new Error('Required `mode` is missing or invalid. Expecting `dev|ci|stage|prod`.');
	}
	if ((!isMPA && !isCMA) || !['mpa', 'cma'].includes(appType)) {
		throw new Error('Must have a valid `config.c10n.&.build.appType` in `package.json`.');
	}
	if (!['any', 'cfp', 'cfw', 'node', 'web', 'webw', 'opl'].includes(targetEnv)) {
		throw new Error('Must have a valid `config.c10n.&.build.targetEnv` in `package.json`.');
	}
	if (isMPA && !mpaEntryIndexSubpath) {
		throw new Error('Multipage apps must have an `./index.html` entry point.');
	}
	if (isCMA && !cmaEntryIndexSubpath) {
		throw new Error('Custom apps must have an `./index.{ts,tsx}` entry point.');
	}

	/**
	 * Prepares `package.json` build-related properties.
	 */
	const updatePkg = {}; // Initialize.

	updatePkg.type = 'module'; // ES module; always.
	updatePkg.files = ['/dist']; // Dist directory only.
	updatePkg.exports = {}; // Exports object initialization.
	updatePkg.sideEffects = ['./src/*.{html,scss,ts,tsx}']; // <https://o5p.me/xVY39g>.

	if (isCMA && (isSSR || cmaEntries.length > 1)) {
		updatePkg.exports = {
			'.': {
				import: './dist/' + cmaEntryIndexSubpathNoExt + '.js',
				require: './dist/' + cmaEntryIndexSubpathNoExt + '.cjs',
				types: './dist/types/' + cmaEntryIndexSubpathNoExt + '.d.ts',
			},
		};
		updatePkg.module = './dist/' + cmaEntryIndexSubpathNoExt + '.js';
		updatePkg.main = './dist/' + cmaEntryIndexSubpathNoExt + '.cjs';

		updatePkg.browser = isWeb ? updatePkg.module : '';
		updatePkg.unpkg = updatePkg.module;

		updatePkg.types = './dist/types/' + cmaEntryIndexSubpathNoExt + '.d.ts';
		updatePkg.typesVersions = { '>=3.1': { './*': ['./dist/types/*'] } };

		for (const cmaEntrySubPathNoExt of cmaEntriesSubpathsNoExt) {
			if (cmaEntrySubPathNoExt === cmaEntryIndexSubpathNoExt) {
				continue; // Don't remap the entry index.
			}
			$obj.mc.patch(updatePkg.exports, {
				['./' + cmaEntrySubPathNoExt]: {
					import: './dist/' + cmaEntrySubPathNoExt + '.js',
					require: './dist/' + cmaEntrySubPathNoExt + '.cjs',
					types: './dist/types/' + cmaEntrySubPathNoExt + '.d.ts',
				},
			});
		}
	} else if (isCMA) {
		updatePkg.exports = {
			'.': {
				import: './dist/' + cmaEntryIndexSubpathNoExt + '.js',
				require: './dist/' + cmaEntryIndexSubpathNoExt + '.umd.cjs',
				types: './dist/types/' + cmaEntryIndexSubpathNoExt + '.d.ts',
			},
		};
		updatePkg.module = './dist/' + cmaEntryIndexSubpathNoExt + '.js';
		updatePkg.main = './dist/' + cmaEntryIndexSubpathNoExt + '.umd.cjs';

		updatePkg.browser = isWeb ? updatePkg.main : '';
		updatePkg.unpkg = updatePkg.main;

		updatePkg.types = './dist/types/' + cmaEntryIndexSubpathNoExt + '.d.ts';
		updatePkg.typesVersions = { '>=3.1': { './*': ['./dist/types/*'] } };
	} else {
		updatePkg.type = 'module'; // Always a module when building with Vite.
		updatePkg.module = updatePkg.main = updatePkg.browser = updatePkg.unpkg = updatePkg.types = '';
		(updatePkg.exports = null), (updatePkg.files = updatePkg.sideEffects = []), (updatePkg.typesVersions = {});
	}

	/**
	 * Pre-updates `package.json` properties impacting build process.
	 */
	await u.updatePkg({ type: updatePkg.type, sideEffects: updatePkg.sideEffects });

	/**
	 * Configures plugins for Vite.
	 *
	 * @see https://github.com/vitejs/vite-plugin-basic-ssl
	 * @see https://github.com/trapcodeio/vite-plugin-ejs
	 * @see https://github.com/zhuweiyou/vite-plugin-minify
	 */
	const pluginBasicSSLConfig = pluginBasicSSL();
	const pluginEJSConfig = pluginEJS(
		{ $build: { require, pkg, mode, env, projDir } },
		{
			ejs: /* <https://o5p.me/wGv5nM> */ {
				strict: true, // JS strict mode.
				async: true, // Support await in EJS files.

				delimiter: '?', // <https://o5p.me/Qwu3af>.
				localsName: '$', // Shorter name for `locals`.
				outputFunctionName: 'echo', // For output in scriptlets.

				root: [srcDir], // For includes with an absolute path.
				views: /* For includes with a relative path ??? includes utilities. */ [
					//
					path.resolve(srcDir, './resources/ejs-views'), // Our standard location for internal EJS views.
					path.resolve(srcDir, './cargo/assets/ejs-views'), // Our standard location for distributed EJS views.

					// If this package is using `@clevercanyon/utilities` we can also leverage EJS fallback utility views.
					...(fs.existsSync(path.resolve(projDir, './node_modules/@clevercanyon/utilities/dist/assets/ejs-views'))
						? [path.resolve(projDir, './node_modules/@clevercanyon/utilities/dist/assets/ejs-views')]
						: []),
				],
			},
		},
	);
	const pluginMinifyHTMLConfig = isDev ? null : pluginMinifyHTML();

	const pluginC10NPostProcessConfig = ((postProcessed = false) => {
		return {
			name: 'vite-plugin-c10n-post-process',
			enforce: 'post', // After others on this hook.

			async closeBundle(/* Rollup hook. */) {
				if (postProcessed) return;
				postProcessed = true;

				/**
				 * Updates `package.json`.
				 */
				await u.updatePkg(updatePkg);

				/**
				 * Copies `./.env.vault` to dist directory.
				 */
				if (fs.existsSync(path.resolve(projDir, './.env.vault'))) {
					await fsp.copyFile(path.resolve(projDir, './.env.vault'), path.resolve(distDir, './.env.vault'));
				}

				/**
				 * Generates typescript type declaration file(s).
				 */
				if ('build' === command) {
					await u.spawn('npx', ['tsc', '--emitDeclarationOnly']);
				}

				/**
				 * Generates a zip archive containing `./dist` directory.
				 */
				if ('build' === command) {
					const archive = archiver('zip', { zlib: { level: 9 } });
					archive.pipe(fs.createWriteStream(path.resolve(projDir, './.~dist.zip')));
					archive.directory(distDir + '/', false);
					await archive.finalize();
				}
			},
		};
	})();
	const plugins = [pluginBasicSSLConfig, pluginEJSConfig, pluginMinifyHTMLConfig, pluginC10NPostProcessConfig];
	const importedWorkerPlugins = []; // <https://vitejs.dev/guide/features.html#web-workers>.

	/**
	 * Configures rollup for Vite.
	 *
	 * @see https://vitejs.dev/config/build-options.html#build-rollupoptions
	 * @see https://rollupjs.org/guide/en/#big-list-of-options
	 */
	const rollupConfig = {
		input: isCMA // Absolute paths.
			? cmaEntries
			: mpaIndexes,

		external: [
			...Object.keys(pkg.peerDependencies || {}),
			'__STATIC_CONTENT_MANIFEST', // Cloudflare workers.
		],
		output: {
			interop: 'auto', // Matches TypeScript config.
			exports: 'named', // Matches TypeScript config.
			esModule: true, // Matches TypeScript config.

			extend: true, // i.e., Global `||` checks.
			noConflict: true, // Like `jQuery.noConflict()`.
		},
	};
	// <https://vitejs.dev/guide/features.html#web-workers>
	const importedWorkerRollupConfig = { ..._.omit(rollupConfig, ['input']) };

	/**
	 * Base config for Vite.
	 *
	 * @see https://vitejs.dev/config/
	 */
	const baseConfig = {
		c10n: { pkg, updatePkg },
		define: {
			// Static replacements.
			$$__APP_PKG_NAME__$$: JSON.stringify(pkg.name || ''),
			$$__APP_PKG_VERSION__$$: JSON.stringify(pkg.version || ''),
			$$__APP_PKG_REPOSITORY__$$: JSON.stringify(pkg.repository || ''),
			$$__APP_PKG_HOMEPAGE__$$: JSON.stringify(pkg.homepage || ''),
			$$__APP_PKG_BUGS__$$: JSON.stringify(pkg.bugs || ''),
		},
		root: srcDir, // Absolute. Where entry indexes live.
		publicDir: path.relative(srcDir, cargoDir), // Relative to `root` directory.
		base: appBasePath + '/', // Analagous to `<base href="/">` ??? leading & trailing slash.

		appType: isCMA ? 'custom' : 'mpa', // See: <https://o5p.me/ZcTkEv>.
		resolve: { alias: importAliases }, // Matches TypeScript config.

		envDir: path.relative(srcDir, envsDir), // Relative to `root` directory.
		envPrefix: appEnvPrefix, // Environment vars w/ this prefix become a part of the app.

		server: { open: true, https: true }, // Vite dev server.
		plugins, // Additional Vite plugins that were configured above.

		...(isSSR // <https://vitejs.dev/config/ssr-options.html>.
			? {
					ssr: {
						noExternal: isSSRNoExternals,
						target: isSSRWorker ? 'webworker' : 'node',
					},
			  }
			: {}),
		worker: /* <https://vitejs.dev/guide/features.html#web-workers> */ {
			format: 'es',
			plugins: importedWorkerPlugins,
			rollupOptions: importedWorkerRollupConfig,
		},
		build: /* <https://vitejs.dev/config/build-options.html> */ {
			target: 'es2021', // Matches TypeScript config.
			emptyOutDir: true, // Must set as `true` explicitly.

			outDir: path.relative(srcDir, distDir), // Relative to `root` directory.
			assetsDir: path.relative(distDir, a16sDir), // Relative to `outDir` directory.
			// Note: `a16s` = numeronym for 'acquired resources'.

			ssr: isSSR, // Server-side rendering?
			...(isSSR ? { ssrManifest: true } : {}),

			sourcemap: isDev, // Enables creation of sourcemaps.
			manifest: true, // Enables creation of manifest for assets.

			...(isCMA // Custom-made apps = library code.
				? {
						lib: {
							name: cmaName,
							entry: cmaEntriesRelPaths,
							// Default formats explicitly. See: <https://o5p.me/v0FR3s>.
							formats: cmaEntries.length > 1 ? ['es', 'cjs'] : ['es', 'umd'],
						},
				  }
				: {}),
			rollupOptions: rollupConfig, // See: <https://o5p.me/5Vupql>.
		},
	};

	/**
	 * Returns base config for Vite.
	 */
	return baseConfig;
};
