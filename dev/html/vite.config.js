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
                "canvas.html",
                "three-animate.html",
                "three-effects.html",
                "three-tsl.html",
                "three-xr.html",
                "vgpu.html",
                "vgpu-scene.html",
            ],
        },
    },
})
