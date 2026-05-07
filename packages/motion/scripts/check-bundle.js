const path = require("path")
const { readFileSync, readdirSync } = require("fs")

/**
 * Verify the published .d.ts bundles are self-contained — no `from "..."` /
 * `from "./..."` references back into the workspace packages we ship with
 * (framer-motion, motion-dom, motion-utils). Users with bespoke tsconfig
 * `paths` setups can map a single file per package, so cross-package type
 * imports break their resolution. See issue #2900.
 */

const distDir = path.join(__dirname, "..", "dist")

function collectDtsFiles(dir, base = "") {
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const rel = base ? path.join(base, entry.name) : entry.name
        if (entry.isDirectory()) {
            if (entry.name === "cjs" || entry.name === "es") continue
            out.push(...collectDtsFiles(path.join(dir, entry.name), rel))
        } else if (entry.name.endsWith(".d.ts")) {
            out.push(rel)
        }
    }
    return out
}

const bundlesToCheck = collectDtsFiles(distDir)

const forbidden = ["framer-motion", "motion-dom", "motion-utils"]

// Match real top-level import/export … from "specifier" statements,
// ignoring `import` references inside JSDoc @example blocks.
const importRegex =
    /^\s*(?:import|export)\b[^'"\n]*?\bfrom\s+['"]([^'"]+)['"]/gm

for (const name of bundlesToCheck) {
    const filePath = path.join(distDir, name)
    const file = readFileSync(filePath, "utf8")
    const stripped = file.replace(/\/\*[\s\S]*?\*\//g, "")

    let match
    while ((match = importRegex.exec(stripped)) !== null) {
        const specifier = match[1]
        const root = specifier.split("/")[0]
        if (forbidden.includes(root)) {
            throw new Error(
                `Type bundle ${name} still imports from workspace package "${specifier}". ` +
                    `Bundled types must be self-contained (issue #2900).`
            )
        }
    }
}
