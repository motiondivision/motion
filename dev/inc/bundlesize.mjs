import fs from "fs"
import path from "path"

const packages = ["framer-motion", "motion-dom"]
const targetPackage = process.argv[2]

if (targetPackage && !packages.includes(targetPackage)) {
    console.error(`Invalid package. Must be one of: ${packages.join(", ")}`)
    process.exit(1)
}

const packagesToCheck = targetPackage ? [targetPackage] : packages

async function checkBundleSize(packageName) {
    const packagePath = path.join(
        process.cwd(),
        "packages",
        packageName,
        "package.json"
    )

    if (!fs.existsSync(packagePath)) {
        console.error(`❌ Package not found: ${packageName}`)
        return true
    }

    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"))

    if (!pkg.bundlesize) {
        console.log(`No bundlesize configuration found for ${packageName}`)
        return false
    }

    let hasFailures = false

    for (const { path: filePath, maxSize } of pkg.bundlesize) {
        const fullPath = path.join(
            process.cwd(),
            "packages",
            packageName,
            filePath
        )

        if (!fs.existsSync(fullPath)) {
            console.error(`❌ File not found: ${filePath}`)
            hasFailures = true
            continue
        }

        // Create gzipped version of file
        const fileContent = fs.readFileSync(fullPath)
        const gzipped = await import("zlib").then((zlib) => {
            return new Promise((resolve, reject) => {
                zlib.gzip(fileContent, (error, result) => {
                    if (error) reject(error)
                    else resolve(result)
                })
            })
        })

        const gzippedSize = gzipped.length
        const maxBytes = parseFloat(maxSize) * 1024
        const gzippedSizeKb = (gzippedSize / 1024).toFixed(2)

        if (gzippedSize > maxBytes) {
            console.error(
                `❌ ${packageName}/${filePath} is ${gzippedSizeKb} kB (${maxSize} allowed)`
            )
            hasFailures = true
        } else {
            console.log(
                `✅ ${packageName}/${filePath} is ${gzippedSizeKb} kB (${maxSize} allowed)`
            )
        }
    }

    return hasFailures
}

async function main() {
    let hasFailures = false

    for (const packageName of packagesToCheck) {
        console.log(`\nChecking ${packageName}...`)
        const packageFailures = await checkBundleSize(packageName)
        hasFailures = hasFailures || packageFailures
    }

    if (hasFailures) {
        process.exit(1)
    }
}

main().catch((error) => {
    console.error("Error:", error)
    process.exit(1)
})
