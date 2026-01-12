const fs = require("fs")
const path = require("path")

function collectRecursive(dir, baseDir = "") {
    const files = []
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
        const relativePath = baseDir ? `${baseDir}/${entry.name}` : entry.name

        if (entry.isDirectory()) {
            // Recurse into subdirectory
            files.push(...collectRecursive(path.join(dir, entry.name), relativePath))
        } else if (
            entry.isFile() &&
            path.extname(entry.name) === ".html" &&
            !entry.name.includes(".skip.")
        ) {
            files.push(relativePath)
        }
    }

    return files
}

function collect(sourceDir, outputFile) {
    const files = collectRecursive(path.join(__dirname, "../html/public/", sourceDir))

    fs.writeFile(
        path.join(
            __dirname,
            `../../packages/framer-motion/cypress/fixtures/${outputFile}.json`
        ),
        JSON.stringify(files),
        "utf8",
        (err) => {
            if (err) {
                return console.error(
                    `Fail to collect ${sourceDir} tests:`,
                    err.message
                )
            }
        }
    )
}

collect("optimized-appear", "appear-tests")
collect("projection", "projection-tests")

console.log("HTML tests collected!")
