import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  unocss: true,
  ignores: [
    'packages/shared/generated/**',
    'packages/shared/prisma/migrations/**',
    'packages/shared/prisma/data.db',
    'dist/**',
    '.opencode/plans/**',
    '.agents/**',
  ],
  rules: {
    'style/semi': ['error', 'never'],
    'ts/no-unused-vars': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
  },
})
