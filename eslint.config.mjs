import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['dist/**','node_modules/**','tmp/**','.runtime/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files:['apps/web/*.js','tests/browser.spec.mjs'], languageOptions:{ globals:{document:'readonly',window:'readonly',location:'readonly',fetch:'readonly',setTimeout:'readonly',clearTimeout:'readonly',URL:'readonly',Blob:'readonly',FormData:'readonly'} } },
  { files:['**/*.mjs'], languageOptions:{ globals:{ console:'readonly',process:'readonly',URL:'readonly' } } }
);
