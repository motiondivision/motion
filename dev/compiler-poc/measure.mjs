/**
 * Bundle each fixture app three ways and print min/gzip sizes:
 * as written, through the compiler, and (where the report says it's
 * eligible) with the mini `motion` component.
 *
 *   node dev/compiler-poc/measure.mjs
 */
import path from "path"
import zlib from "zlib"
import { fileURLToPath } from "url"
import * as esbuild from "esbuild"
import { rollup } from "rollup"
import resolve from "@rollup/plugin-node-resolve"
import replace from "@rollup/plugin-replace"
import terser from "@rollup/plugin-terser"
import {
    analyze,
    listFiles,
    motionCompiler,
    report,
} from "./motion-compiler.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "../..")
const fm = path.join(root, "packages/framer-motion/dist/es")
const external = ["react", "react-dom", "react/jsx-runtime"]

const tsx = {
    name: "tsx",
    async transform(code, id) {
        if (!/\.tsx?$/.test(id)) return
        const out = await esbuild.transform(code, {
            loader: "tsx",
            jsx: "automatic",
            sourcefile: id,
        })
        return { code: out.code, map: null }
    },
}

const useMini = {
    name: "use-mini",
    resolveId(id, importer) {
        if (id === "\0mini-react") return id
        if (!id.startsWith("motion/react") || !importer) return
        if (importer.startsWith("\0"))
            return this.resolve(id, here + "/measure.mjs", { skipSelf: true })
        if (id === "motion/react") return "\0mini-react"
    },
    load(id) {
        if (id === "\0mini-react")
            return `export * from "motion/react"\nexport { motion } from "motion/react-mini"`
    },
}

async function build(input, extra = []) {
    const bundle = await rollup({
        input,
        external,
        onwarn: () => {},
        plugins: [
            ...extra,
            tsx,
            resolve({
                rootDir: root,
                extensions: [".mjs", ".js", ".ts", ".tsx"],
            }),
            replace({
                "process.env.NODE_ENV": JSON.stringify("production"),
                preventAssignment: true,
            }),
            terser({ output: { comments: false } }),
        ],
    })
    const { output } = await bundle.generate({ format: "es" })
    await bundle.close()
    const buf = Buffer.from(output[0].code)
    return `${(buf.length / 1000).toFixed(2)} kB min / ${(
        zlib.gzipSync(buf).length / 1000
    ).toFixed(2)} kB gz`
}

for (const name of ["landing", "dashboard", "wrapper"]) {
    const dir = path.join(here, "fixtures", name)
    const files = listFiles(dir)
    const input = path.join(dir, "index.tsx")
    const result = analyze(files)
    console.log(`\n## ${name}\n${report(result).replaceAll(dir + "/", "")}`)
    console.log(`  as written:  ${await build(input)}`)
    console.log(
        `  compiled:    ${await build(input, [motionCompiler({ files, fm })])}`
    )
    if (!result.miniBlockers.length && !result.unknown.length) {
        console.log(`  mini motion: ${await build(input, [useMini])}`)
    }
}
