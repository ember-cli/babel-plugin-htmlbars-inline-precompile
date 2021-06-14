module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2017,
  },
  plugins: ['node', 'prettier'],
  extends: ['eslint:recommended', 'plugin:node/recommended', 'plugin:prettier/recommended'],
  env: {
    node: true,
  },
  ignorePatterns: ['src/**/*.js', '__tests__/**/*.js'],
  rules: {},
  overrides: [
    // test files
    {
      files: ['__tests__/**/*.js'],
      env: {
        jest: true,
      },
      rules: {
        'node/no-unpublished-require': 'off',
      },
    },
    {
      parserOptions: {
        ecmaVersion: 2020,
      },
      files: ['**/*.ts'],
      plugins: ['@typescript-eslint'],
      extends: [
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
      ],
      rules: {
        'prefer-const': 'off',
        'node/no-unsupported-features/es-syntax': [
          'error',
          {
            ignores: ['modules'],
          },
        ],
        'node/no-missing-import': 'off',

        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/explicit-function-return-type': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/explicit-module-boundary-types': ['off'],

        // We should try to remove this eventually
        '@typescript-eslint/explicit-function-return-type': 'off',

        '@typescript-eslint/ban-types': [
          'error',
          {
            types: {
              // we currently use `object` as "valid WeakMap key" in a lot of APIs
              object: false,
            },
          },
        ],

        // disabling this one because of DEBUG APIs, if we ever find a better
        // way to suport those we should re-enable it
        '@typescript-eslint/no-non-null-assertion': 'off',

        '@typescript-eslint/no-use-before-define': 'off',
      },
    },
  ],
};
