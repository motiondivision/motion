import { defineConfig, type Plugin } from "vite"

/**
 * Serve `/ssr.html?test=name`: the test page rendered with Remix's
 * renderToString(), ready to hydrate.
 */
function serverRender(): Plugin {
    return {
        name: "remix-ssr",
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const url = new URL(req.url!, "http://localhost")
                if (url.pathname !== "/ssr.html") return next()

                try {
                    const test = url.searchParams.get("test")
                    const [{ renderToString }, { App }, { jsx }] =
                        await Promise.all([
                            server.ssrLoadModule("remix/component/server"),
                            server.ssrLoadModule(`/src/tests/${test}.tsx`),
                            server.ssrLoadModule("remix/component/jsx-runtime"),
                        ])
                    const html = await renderToString(jsx(App, {}))
                    res.setHeader("content-type", "text/html")
                    res.end(
                        `<!DOCTYPE html><html><head><link rel="stylesheet" href="/src/index.css" /></head><body><div id="root">${html}</div><script type="module" src="/src/hydrate.tsx"></script></body></html>`
                    )
                } catch (error) {
                    next(error)
                }
            })
        },
    }
}

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        port: parseInt(process.env.TEST_PORT || "9992"),
        hmr: false,
    },
    plugins: [serverRender()],
    esbuild: {
        jsx: "automatic",
        jsxImportSource: "remix/component",
    },
    resolve: {
        alias: [
            { find: /^remix\/component/, replacement: "@remix-run/component" },
        ],
    },
    optimizeDeps: {
        include: [
            "@remix-run/component",
            "@remix-run/component/jsx-dev-runtime",
        ],
    },
    ssr: {
        noExternal: ["motion", "framer-motion", "motion-dom", "motion-utils"],
    },
})
