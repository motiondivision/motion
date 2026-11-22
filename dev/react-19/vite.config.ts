import { build } from "esbuild"
import path from "path"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

const cookie = (cookies: string, name: string) =>
    new RegExp(`(?:^|; )${name}=([^;]*)`).exec(cookies)?.[1]

/**
 * Stands in for a slow network. async-lab.html sets two cookies:
 *
 * `motion-hydrate` holds back the script of a page whose script is marked
 * ?hydrate, so its server-rendered HTML shows for that long first.
 *
 * `motion-delay` holds back the layout and drag code Motion fetches. The
 * dev server doesn't bundle, so a page that imports all of `motion/react`
 * also loads those files with the page. Motion's own fetches are marked
 * ?lazy, so that only they are held.
 */
const delayCode = () => ({
    name: "delay-motion-code",
    transform(code: string, id: string) {
        if (!/motion-async\/loaders\.mjs/.test(id)) return
        return code.replace(/(import\('[^']+\.mjs)'/g, "$1?lazy'")
    },
    configureServer(server: any) {
        server.middlewares.use((req: any, _res: any, next: () => void) => {
            const cookies = req.headers.cookie || ""
            const url = req.url || ""
            const delay = parseInt(
                (/[?&]hydrate/.test(url)
                    ? cookie(cookies, "motion-hydrate")
                    : /[?&]lazy/.test(url)
                    ? cookie(cookies, "motion-delay")
                    : "") || "0"
            )

            delay ? setTimeout(next, delay) : next()
        })
    },
})

/**
 * Renders a page on the server. A root element with data-ssr names the
 * module whose `App` it holds. `App` is given the request's cookies and
 * URL, which the page's script gives it again to hydrate.
 */
const renderOnServer = () => {
    let cookies = ""

    return {
        name: "render-on-server",
        configureServer(server: any) {
            server.middlewares.use((req: any, _res: any, next: () => void) => {
                if (/\.html/.test(req.url || "")) {
                    cookies = req.headers.cookie || ""
                }
                next()
            })
        },
        async transformIndexHtml(html: string, context: any) {
            const [root, file] =
                /<div id="root" data-ssr="([^"]+)">/.exec(html) || []
            if (!file || !context.server) return html

            /**
             * Bundled with Motion, and saved inside this app, so that
             * both use this app's React.
             */
            const outfile = path.join(
                __dirname,
                "node_modules/.server-render",
                path.basename(file) + ".mjs"
            )
            await build({
                stdin: {
                    contents: `
                        import { createElement } from "react"
                        import { renderToString } from "react-dom/server"
                        import { App } from ${JSON.stringify("." + file)}
                        export const render = (props) =>
                            renderToString(createElement(App, props))`,
                    resolveDir: __dirname,
                },
                outfile,
                bundle: true,
                format: "esm",
                platform: "node",
                jsx: "automatic",
                external: ["react", "react-dom", "react/*", "react-dom/*"],
                define: { "process.env.NODE_ENV": '"development"' },
                logLevel: "error",
            })
            const { render } = await import(outfile + "?" + Date.now())

            return html.replace(
                root,
                root + render({ cookies, url: context.originalUrl })
            )
        },
    }
}

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        port: parseInt(process.env.TEST_PORT || "9991"),
        hmr: false,
    },
    plugins: [react(), delayCode(), renderOnServer()],
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
