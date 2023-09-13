/**
 * Stylelint config file.
 *
 * Stylelint is not aware of this config file's location.
 *
 * @note PLEASE DO NOT EDIT THIS FILE!
 * @note This entire file will be updated automatically.
 * @note Instead of editing here, please review <https://github.com/clevercanyon/skeleton>.
 *
 * @see https://stylelint.io/user-guide/configure
 */

import exclusions from '../bin/includes/exclusions.mjs';
import extensions from '../bin/includes/extensions.mjs';

/**
 * Defines Stylelint configuration.
 */
export default async () => {
	/**
	 * Base config.
	 */
	const baseConfig = {
		ignoreFiles: [
			...exclusions.vcsFilesDirs, //
			...exclusions.packageDirs,
			...exclusions.distDirs,
			...exclusions.sandboxDirs,
		],
		plugins: [
			'stylelint-scss', //
			'stylelint-order',
		],
		extends: [
			'stylelint-config-standard-scss', //
			'stylelint-config-recess-order',
		],
		rules: {
			'no-duplicate-selectors': null,
			'selector-type-no-unknown': null,
			'no-descending-specificity': null,
			'selector-class-pattern': '^[_-]?[a-z][a-z0-9]*(?:[_-]{1,2}[a-z0-9]+)*$',
			'selector-id-pattern': '^[a-z][a-z0-9]*(?:[_-]{1,2}[a-z0-9]+)*$',
			'at-rule-no-unknown': [true, { ignoreAtRules: ['tailwind', 'apply', 'variants', 'responsive', 'screen'] }],
		},
	};

	/**
	 * Composition.
	 */
	return {
		...baseConfig,

		overrides: [
			{
				files: ['**/*.' + extensions.asGlob(extensions.css)],

				plugins: [...baseConfig.plugins],
				extends: [...baseConfig.extends],
				ignoreFiles: [...baseConfig.ignoreFiles],

				customSyntax: 'postcss-safe-parser',
				rules: { ...baseConfig.rules },
			},
			{
				files: ['**/*.' + extensions.asGlob(extensions.scss)],

				plugins: [...baseConfig.plugins],
				extends: [...baseConfig.extends],
				ignoreFiles: [...baseConfig.ignoreFiles],

				customSyntax: 'postcss-scss',
				rules: {
					...baseConfig.rules,
					'scss/at-rule-no-unknown': baseConfig.rules['at-rule-no-unknown'],
				},
			},
		],
	};
};
