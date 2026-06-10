import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base: "./" makes all asset paths relative, so the build works under any
// GitHub Pages project subpath (https://<user>.github.io/<repo>/) without
// hardcoding the repo name. (If you later add client-side routing, switch to
// base: "/<repo-name>/" and add a 404.html SPA fallback.)
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
