import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        port: parseInt(process.env.TEST_PORT || "9990"),
        hmr: false,
    },
    plugins: [react()],
})
