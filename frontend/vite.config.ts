import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // Read .env / .env.local. Backend port is overridable to dodge local conflicts.
  const env = loadEnv(mode, process.cwd());
  const backendPort = env.VITE_BACKEND_PORT || "8000";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        "/api": `http://localhost:${backendPort}`,
      },
    },
  };
});
