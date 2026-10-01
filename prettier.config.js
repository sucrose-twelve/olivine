/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
module.exports = {
  bracketSameLine: true,
  endOfLine: 'lf',
  importOrder: ['<BUILTIN_MODULES>', '', '<THIRD_PARTY_MODULES>', '', '^(@/).*$', '', '^[.]'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ['typescript', 'decorators-legacy'],
  plugins: ['@ianvs/prettier-plugin-sort-imports'],
  printWidth: 120,
  proseWrap: 'never',
  quoteProps: 'consistent',
  semi: false,
  singleQuote: false,
  trailingComma: 'none'
}
