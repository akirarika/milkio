module.exports = {
    "env": {
        "browser": true,
        "es2021": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    "overrides": [
        {
            "env": {
                "node": true
            },
            "files": [
                ".eslintrc.{js,cjs}"
            ],
            "parserOptions": {
                "sourceType": "script"
            }
        }
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "plugins": [
        "@typescript-eslint"
    ],
    "rules": {
        "indent": ["error", 2],
        "quotes": ["error", "double"],
        "semi": ["error", "never"],
        "curly": "off",
        "quotes": "off",
        "no-empty": "off",
        "no-console": "error",
        "default-case-last": "off",
        "no-useless-return": "off",
        "@typescript-eslint/quotes": "off",
        "@typescript-eslint/return-await": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-unused-vars": "warn",
        "@typescript-eslint/no-throw-literal": "off",
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/prefer-ts-expect-error": "off",
        "@typescript-eslint/triple-slash-reference": "off",
        "@typescript-eslint/strict-boolean-expressions": "off",
        "@typescript-eslint/no-confusing-void-expression": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-unnecessary-type-assertion": "off",
        "@typescript-eslint/consistent-type-definitions": ["error", "type"],
        "@typescript-eslint/no-explicit-any": ["error", { "ignoreRestArgs": false }],
        "@typescript-eslint/array-type": ["warn", { "default": "generic", "readonly": "generic" }],
    }
}
