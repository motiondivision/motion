/** @jest-environment node */
import { execFileSync } from "child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { resolve } from "path"

const root = resolve(__dirname, "../../../..")

describe("published AnimateView entry point", () => {
    it("typechecks public declarations with React 18 and skipLibCheck disabled", () => {
        const directory = mkdtempSync(resolve(tmpdir(), "motion-animate-view-"))
        try {
            writeFileSync(
                resolve(directory, "index.tsx"),
                `
                import { motion } from "motion/react"
                import { AnimateView, AnimateViewProps } from "motion/react-animate-view"
                const props: AnimateViewProps = { enter: { opacity: 1 } }
                export const view = <AnimateView {...props}><motion.div /></AnimateView>
            `
            )
            writeFileSync(
                resolve(directory, "tsconfig.json"),
                JSON.stringify({
                    compilerOptions: {
                        noEmit: true,
                        strict: true,
                        skipLibCheck: false,
                        jsx: "react-jsx",
                        module: "esnext",
                        moduleResolution: "bundler",
                        target: "es2020",
                        types: ["react"],
                        typeRoots: [resolve(root, "node_modules/@types")],
                        paths: {
                            "motion/react": [
                                resolve(
                                    root,
                                    "packages/motion/dist/react.d.ts"
                                ),
                            ],
                            "motion/react-animate-view": [
                                resolve(
                                    root,
                                    "packages/motion/dist/react-animate-view.d.ts"
                                ),
                            ],
                            "react/jsx-runtime": [
                                resolve(
                                    root,
                                    "node_modules/@types/react/jsx-runtime.d.ts"
                                ),
                            ],
                        },
                    },
                    files: ["index.tsx"],
                })
            )
            execFileSync(
                process.execPath,
                [
                    resolve(root, "node_modules/typescript/bin/tsc"),
                    "-p",
                    directory,
                ],
                { stdio: "pipe" }
            )
        } finally {
            rmSync(directory, { recursive: true, force: true })
        }
    })
    it("publishes separate JavaScript and declaration entry points", () => {
        for (const [name, entry] of [
            ["motion", "react-animate-view"],
            ["framer-motion", "animate-view"],
        ]) {
            const directory = resolve(root, "packages", name)
            const pkg = JSON.parse(
                readFileSync(resolve(directory, "package.json"), "utf8")
            )
            expect(pkg.exports[`./${entry}`]).toEqual({
                types: `./dist/${entry}.d.ts`,
                require: `./dist/cjs/${entry}.js`,
                import: `./dist/es/${entry}.mjs`,
                default: `./dist/cjs/${entry}.js`,
            })
            for (const file of Object.values(pkg.exports[`./${entry}`])) {
                expect(
                    readFileSync(resolve(directory, file as string), "utf8")
                ).not.toHaveLength(0)
            }
        }
    })

    it.each(["commonjs", "module"])(
        "keeps React 18 imports and rendering working in %s",
        (format) => {
            const load = format === "module" ? "await import" : "require"
            execFileSync(
                process.execPath,
                [
                    `--input-type=${format}`,
                    "-e",
                    `
                const assert = (${load}("node:assert/strict")).default || require("node:assert/strict")
                const React = ${load}("react")
                const { renderToString } = ${load}("react-dom/server")
                const main = ${load}("motion/react")
                assert.equal(React.version.split(".")[0], "18")
                assert.equal(main.AnimateView, undefined)
                assert.match(renderToString(React.createElement(main.motion.div, null, "hello")), /hello/)
                const { AnimateView } = ${load}("motion/react-animate-view")
                assert.equal(typeof AnimateView, "function")
                assert.throws(() => renderToString(React.createElement(AnimateView)), /AnimateView requires React 19.3/)
                `,
                ],
                { cwd: root, stdio: "pipe" }
            )
        }
    )
})
