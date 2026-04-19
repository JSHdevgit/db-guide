import nextConfig from 'eslint-config-next'
import tailwind from 'eslint-plugin-tailwindcss'

/** @type {import('eslint').Linter.Config[]} */
const config = [
  ...nextConfig,
  ...tailwind.configs['flat/recommended'],
  {
    settings: {
      react: { version: '19.2.4' },
      tailwindcss: {
        config: {},
        cssFiles: ['app/globals.css'],
      },
    },
    rules: {
      'tailwindcss/classnames-order': 'warn',
      'tailwindcss/no-custom-classname': 'off',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
]

export default config
