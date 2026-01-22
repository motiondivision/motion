import path from "path"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        port: 9991,
        hmr: false,
    },
    plugins: [react()],
    resolve: {
        dedupe: ["react", "react-dom"],
        alias: {
            react: path.resolve(__dirname, "node_modules/react"),
            "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
        },
    },
    optimizeDeps: {
        include: ["react", "react-dom", "@radix-ui/react-dialog"],
        force: true,
    },
})
