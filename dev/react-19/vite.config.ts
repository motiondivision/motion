import path from "path"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

/**
 * Holds Motion's feature files back by the time in the `motion-delay`
 * cookie, which async-lab.html sets, to stand in for a slow network.
 */
const delayFeatures = () => ({
    name: "delay-motion-features",
    configureServer(server: any) {
        server.middlewares.use((req: any, _res: any, next: () => void) => {
            const delay = parseInt(
                /motion-delay=(\d+)/.exec(req.headers.cookie || "")?.[1] || "0"
            )
            const isFeature =
                /animation\/appear\/animations\.m?js|motion\/features\/(layout|drag)\.m?js/.test(
                    req.url || ""
                )

            delay && isFeature ? setTimeout(next, delay) : next()
        })
    },
})

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        port: parseInt(process.env.TEST_PORT || "9991"),
        hmr: false,
    },
    plugins: [react(), delayFeatures()],
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
