import { defineConfig, type UserConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readFileSync } from "fs";

// Read version from package.json
const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig(({ mode }) => {
  const isProd = mode === "production";

  const config: UserConfig = {
    plugins: [svelte()],
    base: "./",
    build: {
      outDir: "dist",
      emptyOutDir: true,
      target: "esnext",
      sourcemap: !isProd,
      minify: isProd ? "esbuild" : false,
      cssMinify: isProd,
      rollupOptions: {
        output: {
          assetFileNames: isProd
            ? "assets/[name]-[hash][extname]"
            : "assets/[name][extname]",
          chunkFileNames: isProd ? "chunks/[name]-[hash].js" : "chunks/[name].js",
          entryFileNames: isProd ? "[name]-[hash].js" : "[name].js",
          manualChunks: isProd
            ? {
                vendor: ["@microsoft/teams-js"],
                fluent: ["@fluentui/web-components"],
              }
            : undefined,
        },
      },
      chunkSizeWarningLimit: 500,
    },
    server: {
      port: 3200,
      strictPort: true,
    },
    preview: {
      port: 3200,
      strictPort: true,
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    // Handle SPA routing for /embed and other routes
    appType: 'spa',
  };

  return config;
});
