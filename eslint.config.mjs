import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    ignores: [".next/**", "node_modules/**", "test-results/**", "playwright-report/**"],
  },
  {
    rules: {
      // eslint-config-next 16 bundles the experimental React Compiler
      // lint rules, which flag long-idiomatic patterns this codebase uses
      // throughout (deriving expiry from Date.now() at render time,
      // setting state from an effect to seed/sync local UI state from a
      // store) as hard errors. These aren't correctness bugs — downgraded
      // to warnings so real regressions still surface without blocking
      // every existing effect-based component.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
