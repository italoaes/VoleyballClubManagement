/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// Base configurável:
// - APK/Capacitor e dev: "./" (caminhos relativos, servido via file://)
// - GitHub Pages: defina DEPLOY_BASE="/VoleyballClubManagement/" no build.
const base = process.env.DEPLOY_BASE ?? "./";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Volleyball Club Management",
        short_name: "VCM26",
        description: "Volleyball Club Management — lidere seu time ao título.",
        theme_color: "#0b1b2b",
        background_color: "#0b1b2b",
        display: "standalone",
        orientation: "portrait",
        start_url: base === "./" ? "." : base,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // precacha só o app shell + assets leves; escudos grandes carregam
        // sob demanda (runtime caching) para não pesar o carregamento inicial.
        globPatterns: ["**/*.{js,css,html,woff2}", "assets/avatars/*.png", "assets/ui/*.png"],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/crests\/.*\.png$/,
            handler: "CacheFirst",
            options: {
              cacheName: "crests",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@engine": fileURLToPath(new URL("./src/engine", import.meta.url)),
      "@domain": fileURLToPath(new URL("./src/domain", import.meta.url)),
      "@state": fileURLToPath(new URL("./src/state", import.meta.url)),
      "@persistence": fileURLToPath(new URL("./src/persistence", import.meta.url)),
      "@ui": fileURLToPath(new URL("./src/ui", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
