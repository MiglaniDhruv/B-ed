import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  assetsInclude: ["**/*.svg", "**/*.csv"],
  server: {
    port: 3000, // 👈 yaha port change karo
    host: true, // 👈 LAN/IP pe access ke liye
    strictPort: true, // 👈 auto change na kare
    proxy: {
      "/api": {
        target: "https://kachhli.duckdns.org/",
        changeOrigin: true,
      },
      "/admin/forgot-password": {
        target: "https://kachhli.duckdns.org/",
        changeOrigin: true,
      },
      "/admin/reset-password": {
        target: "https://kachhli.duckdns.org/",
        changeOrigin: true,
      },
    },
  },
});
