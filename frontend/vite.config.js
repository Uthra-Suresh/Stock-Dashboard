import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// CHANGE THIS to your repository name.
//
// A project site is served from https://USERNAME.github.io/REPO-NAME/, not
// from the domain root. Without a matching base, every asset resolves to
// /assets/index.js instead of /REPO-NAME/assets/index.js and you get a blank
// white page with 404s in the console. This is the single most common
// "my Pages deploy is broken" cause.
//
// If you later use a custom domain or a USERNAME.github.io repo, set this
// back to "/".
const REPO_NAME = "Stock-Dashboard";

export default defineConfig({
  plugins: [react()],
  base: `/${REPO_NAME}/`,
});
