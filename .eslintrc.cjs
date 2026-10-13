module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react'],
  extends: ['eslint:recommended', 'plugin:react/recommended'],
  settings: { react: { version: 'detect' } },
  ignorePatterns: ['dist/', 'build/', 'node_modules/'],
  rules: {
    'react/prop-types': 'off',
    'react/no-unknown-property': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
  }
}
