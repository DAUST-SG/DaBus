import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    // React 19's compiler-style checks flag patterns this app relies on (loaders declared
    // after the effect that calls them, resetting state in effects); warn, don't fail
    rules: {
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  { ignores: [".next/**", "convex/_generated/**", "node_modules/**"] },
];

export default config;
