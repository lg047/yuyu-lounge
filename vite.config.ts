import { defineConfig } from "vite";

// Ensure assets resolve correctly when served from /yuyu-lounge on GitHub Pages
export default defineConfig({
  base: "/yuyu-lounge/",
});
