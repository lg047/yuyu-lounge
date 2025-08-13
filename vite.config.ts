import { defineConfig } from "vite";

export default defineConfig({
  // Ensure correct asset paths on GitHub Pages
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
