// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'scripts/**/*.js'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // ========== 类型安全 ==========
      // 取消 any 类型提示（有些地方因为库的原因）
      "@typescript-eslint/no-explicit-any": 'off',
      // 不安全的赋值 any
      "@typescript-eslint/no-unsafe-assignment": "off",
      // 不安全的成员访问
      "@typescript-eslint/no-unsafe-member-access": "off",
      // 不安全的返回
      "@typescript-eslint/no-unsafe-return": "off",
      // 警告未处理的 Promise
      "@typescript-eslint/no-floating-promises": "error",
      // 警告不安全的参数
      "@typescript-eslint/no-unsafe-argument": "warn",
      // 不安全的调用
      "@typescript-eslint/no-unsafe-call": "warn",

      // ========== 空值和类型断言 ==========
      // 防止空值
      "@typescript-eslint/no-unnecessary-condition": "off",
      // 禁止不必要的类型断言
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      // 警告非空断言
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-redundant-type-constituents": "off",

      // ========== Promise/异步 ==========
      // Promise 必须有错误处理
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          "checksVoidReturn": {
            "attributes": false
          }
        }
      ],
      // 确保只 await thenable 的值
      "@typescript-eslint/await-thenable": "warn",

      // ========== 类型声明 ==========
      // 禁止空接口
      "@typescript-eslint/no-empty-interface": "warn",

      // ========== 命名约定 ==========
      "@typescript-eslint/naming-convention": [
        'warn',
        {
          "selector": "default",
          "format": ["camelCase"]
        },
        {
          "selector": "variable",
          "format": ["camelCase", "UPPER_CASE", "PascalCase"],
          "leadingUnderscore": "allow"
        },
        {
          "selector": "function",
          "format": ["camelCase", "PascalCase"],
          "leadingUnderscore": "allow"
        },
        {
          "selector": "typeParameter",
          "format": ["PascalCase"],
          // 允许单个大写字母
          "custom": {
            "regex": "^[A-Z]$|^[A-Z][a-zA-Z0-9]*$",
            "match": true
          }
        },
        {
          "selector": "parameter",
          "format": ["camelCase"],
          "leadingUnderscore": "allow"
        },
        {
          "selector": ["class", "interface", "typeAlias", "enum"],
          "format": ["PascalCase"]
        },
        {
          "selector": "enumMember",
          "format": ["UPPER_CASE", "PascalCase"]
        }
      ],

      // ========== 代码风格 ==========
      // 未使用变量
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_",
          "ignoreRestSiblings": true
        }
      ],

      // ========== 格式化 ==========
      "prettier/prettier": [
        "error",
        {
          "endOfLine": "auto"
        }
      ]
    },
  },
);
