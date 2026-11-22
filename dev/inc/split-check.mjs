// Measures what a bundler loads first for motion.div, and what it leaves
// for later, with esbuild's splitting and with Rollup.
import { fileURLToPath } from "url"
import zlib from "zlib"
import path from "path"
import { rollup } from "rollup"
import resolve from "@rollup/plugin-node-resolve"
import replace from "@rollup/plugin-replace"
import terser from "@rollup/plugin-terser"
import * as esbuild from "esbuild"
const root = fileURLToPath(new URL("../..", import.meta.url))
const external = ["react", "react-dom", "react/jsx-runtime", "react-dom/client"]
const gz = (s) => zlib.gzipSync(Buffer.from(s)).length
const kb = (n) => (n / 1024).toFixed(2)
const code = process.argv.slice(2).find((a) => !a.startsWith("--")) || `import { motion } from "motion/react"; export const D = motion.div`
const detail = process.argv.includes("--detail")

async function withEsbuild() {
    const result = await esbuild.build({
        stdin: { contents: code, resolveDir: path.join(root, "packages/motion"), loader: "js" },
        bundle: true, splitting: true, format: "esm", minify: true, write: false, outdir: "out", metafile: true,
        external, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
    })
    const files = Object.fromEntries(result.outputFiles.map((f) => [path.basename(f.path), f.text]))
    const meta = result.metafile.outputs
    const name = (k) => path.basename(k)
    const entry = Object.keys(meta).find((k) => meta[k].entryPoint)
    const first = new Set()
    const walk = (k) => { if (first.has(k)) return; first.add(k); meta[k].imports.filter((i) => i.kind === "import-statement" && meta[i.path]).forEach((i) => walk(i.path)) }
    walk(entry)
    const size = (keys) => [...keys].reduce((a, k) => a + gz(files[name(k)]), 0)
    console.log("esbuild  first", kb(size(first)), "all", kb(size(Object.keys(meta))), "files", Object.keys(meta).length)
    for (const k of Object.keys(meta)) console.log("   ", first.has(k) ? "first" : "lazy ", kb(gz(files[name(k)])), name(k))
    if (detail) {
        const inputs = {}
        for (const k of first) for (const [i, v] of Object.entries(meta[k].inputs)) inputs[i] = (inputs[i] || 0) + v.bytesInOutput
        Object.entries(inputs).sort((a, b) => b[1] - a[1]).slice(0, 60).forEach(([i, b]) => console.log("      ", String(b).padStart(6), i.replace(/.*packages\//, "")))
    }
}
async function withRollup() {
    const mods = {}
    const bundle = await rollup({ input: "\0entry", external, onwarn: () => {}, plugins: [
        { name: "v", resolveId: (id) => (id === "\0entry" ? id : null), load: (id) => (id === "\0entry" ? code : null) },
        resolve({ rootDir: root }), replace({ "process.env.NODE_ENV": JSON.stringify("production"), preventAssignment: false }), terser({ output: { comments: false } }) ] })
    const { output } = await bundle.generate({ format: "es", dir: "out" })
    const chunks = Object.fromEntries(output.map((c) => [c.fileName, c]))
    const first = new Set()
    const walk = (f) => { if (first.has(f)) return; first.add(f); chunks[f].imports.filter((x) => chunks[x]).forEach(walk) }
    walk(output.find((c) => c.isEntry).fileName)
    const size = (set) => [...set].reduce((a, f) => a + gz(chunks[f].code), 0)
    console.log("rollup   first", kb(size(first)), "all", kb(size(Object.keys(chunks))), "files", output.length)
    for (const c of output) console.log("   ", first.has(c.fileName) ? "first" : "lazy ", kb(gz(c.code)), c.fileName)
    if (detail) {
        for (const f of first) for (const [id, m] of Object.entries(chunks[f].modules)) mods[id] = m.renderedLength
        Object.entries(mods).sort((a, b) => b[1] - a[1]).slice(0, 70).forEach(([i, b]) => console.log("      ", String(b).padStart(6), i.replace(/.*packages\//, "")))
    }
}
await withEsbuild()
await withRollup()
