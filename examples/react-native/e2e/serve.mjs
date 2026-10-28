import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join } from "node:path"

/**
 * Serves the web export in dist/, falling back to index.html.
 */
const root = new URL("../dist", import.meta.url).pathname
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" }

createServer((req, res) => {
    let file = join(root, decodeURIComponent(req.url.split("?")[0]))
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html")
    res.setHeader("content-type", types[extname(file)] || "application/octet-stream")
    createReadStream(file).pipe(res)
}).listen(Number(process.env.PORT) || 8099)
