import { defineConfig } from "vite";

export default defineConfig({
  // Ensure correct asset paths on GitHub Pages
  base: "/yuyu-lounge/",
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
