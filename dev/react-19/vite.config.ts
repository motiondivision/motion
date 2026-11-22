import path from "path"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

/**
 * Holds the feature files Motion fetches back by the time in the
 * `motion-delay` cookie, which async-lab.html sets, to stand in for a
 * slow network.
 *
 * The dev server doesn't bundle, so a page that imports all of
 * `motion/react` also loads these files with the page. Motion's own
 * fetches are marked, so that only they are held.
 */
const delayFeatures = () => ({
    name: "delay-motion-features",
    transform(code: string, id: string) {
        if (!/motion-(async\/loaders|appear\/async)\.mjs/.test(id)) return
        return code.replace(/(import\('[^']+\.mjs)'/g, "$1?lazy'")
    },
    configureServer(server: any) {
        server.middlewares.use((req: any, _res: any, next: () => void) => {
            const delay = parseInt(
                /motion-delay=(\d+)/.exec(req.headers.cookie || "")?.[1] || "0"
            )

            delay && /[?&]lazy/.test(req.url || "")
                ? setTimeout(next, delay)
                : next()
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
