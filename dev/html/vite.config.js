import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        port: 8000,
        hmr: false,
    },
    build: {
        rollupOptions: {
            input: [
                "index.html",
                "three-animate.html",
                "three-effects.html",
                "three-tsl.html",
                "vgpu.html",
                "vgpu-scene.html",
            ],
        },
    },
})
