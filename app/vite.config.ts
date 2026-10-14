import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Für die Vorschau als Claude-Artifact: VITE_ROUTER=hash npm run build (relative Pfade, Hash-Links)
  base: process.env.VITE_ROUTER === "hash" ? "./" : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg"],
      manifest: {
        name: "Booktracker",
        short_name: "Booktracker",
        description: "Mein Regal, mein SuB, meine Lesejahre",
        lang: "de",
        start_url: "/",
        display: "standalone",
        background_color: "#EEF6FA",
        theme_color: "#1E7EBE",
        icons: [
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "fonts" }
          },
          {
            urlPattern: /\/demo\/data\.json$/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "demo-data" }
          },
          {
            // Buchcover von Open Library und Google: einmal geladen, 60 Tage auf dem Gerät behalten (auch offline)
            urlPattern: /^https:\/\/(covers\.openlibrary\.org|books\.google\.com|books\.googleusercontent\.com|lh\d\.googleusercontent\.com)\//,
            handler: "CacheFirst",
            options: {
              cacheName: "covers",
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  server: { port: 5173, host: true }
});
