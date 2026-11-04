import { defineConfig } from "vite";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";


// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const localAdminTestEnv =
    command === "serve" && mode === "admin-test"
      ? loadEnv(mode, process.cwd(), "ADMIN_TEST_")
      : {};
  return {
    envPrefix:
      command === "serve" && mode === "admin-test"
        ? ["VITE_", "ADMIN_TEST_"]
        : "VITE_",
    define: {
      "import.meta.env.ADMIN_TEST_EMAIL": JSON.stringify(localAdminTestEnv.ADMIN_TEST_EMAIL ?? ""),
      "import.meta.env.ADMIN_TEST_PASSWORD": JSON.stringify(localAdminTestEnv.ADMIN_TEST_PASSWORD ?? ""),
    },
    server: {
      host: "127.0.0.1",
      port: 3000,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8799",
          changeOrigin: true,
          headers: { Origin: "http://127.0.0.1:8799" },
        },
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            motion: ["framer-motion"],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
