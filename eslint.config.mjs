// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const UI_PRIMITIVES = "src/ui/primitives/**/*.{ts,tsx}";
const UI_LAYOUT = "src/ui/layout/**/*.{ts,tsx}";

const eslintConfig = defineConfig([...nextVitals, ...nextTs, globalIgnores([
  ".next/**",
  "out/**",
  "build/**",
  "next-env.d.ts",
]), /* Design system enforcement (Stage B): raw HTML, inline styles, palette colors, spacing */
{
  files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
  ignores: [UI_PRIMITIVES, UI_LAYOUT],
  rules: {
    "no-restricted-syntax": [
      "warn",
      { selector: "JSXOpeningElement[name.name='button']", message: "Use <Button /> from @/ui." },
      { selector: "JSXOpeningElement[name.name='input']", message: "Use <Input /> from @/ui." },
      { selector: "JSXOpeningElement[name.name='select']", message: "Use <Select /> from @/ui." },
      { selector: "JSXOpeningElement[name.name='textarea']", message: "Use <Textarea /> from @/ui." },
      { selector: "JSXOpeningElement[name.name='table']", message: "Use <Table /> from @/ui." },
      { selector: "JSXAttribute[name.name='style']", message: "Inline styles not allowed. Use design tokens." },
      {
        selector: "Literal[value=/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
        message: "No hardcoded hex colors. Use design tokens (e.g. var(--primary)).",
      },
      {
        selector: "JSXAttribute[name.name='className'] Literal[value=/(^|\\s)(bg|text|border|ring|fill|stroke)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|slate|zinc|neutral|stone)-\\d{2,3}(\\s|$)/]",
        message: "Use tokenized colors (e.g. text-[var(--text)], bg-[var(--primary)]) instead of Tailwind palette.",
      },
      {
        selector: "JSXAttribute[name.name='className'] Literal[value=/(^|\\s)(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y)-(\\d+|\\d+\\/\\d+)(\\s|$)/]",
        message: "Prefer <Stack>, <Section>, <Grid>, <Container> from @/ui for spacing.",
      },
    ],
  },
}, ...storybook.configs["flat/recommended"]]);

export default eslintConfig;
