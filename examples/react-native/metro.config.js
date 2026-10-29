const { getDefaultConfig } = require("expo/metro-config")
const fs = require("fs")
const path = require("path")

const root = path.resolve(__dirname, "../..")
const packages = path.join(root, "packages")
const config = getDefaultConfig(__dirname)

const local = new Set(["motion", "framer-motion", "motion-dom", "motion-utils"])

/**
 * Link Motion's packages into a node_modules folder here, so Metro resolves
 * them like installed packages, through their package exports.
 */
const links = path.join(__dirname, ".motion")
for (const name of local) {
    const link = path.join(links, "node_modules", name)
    if (fs.existsSync(link)) continue
    fs.mkdirSync(path.dirname(link), { recursive: true })
    fs.symlinkSync(path.join(packages, name), link, "dir")
}

/**
 * Resolve Motion from this repo's built packages. Everything those packages
 * import (react, react-native, reanimated) resolves from this app, so
 * there's only one copy of each.
 */
config.watchFolders = [packages, links]
config.resolver.resolveRequest = (context, moduleName, platform) => {
    const name = moduleName.startsWith("@")
        ? moduleName.split("/").slice(0, 2).join("/")
        : moduleName.split("/")[0]

    if (local.has(name)) {
        return context.resolveRequest(
            { ...context, originModulePath: path.join(links, "index.js") },
            moduleName,
            platform
        )
    }

    if (
        context.originModulePath.startsWith(packages) &&
        !moduleName.startsWith(".") &&
        !path.isAbsolute(moduleName)
    ) {
        return context.resolveRequest(
            { ...context, originModulePath: path.join(__dirname, "index.js") },
            moduleName,
            platform
        )
    }

    return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
