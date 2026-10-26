const { getDefaultConfig } = require("expo/metro-config")
const path = require("path")

const root = path.resolve(__dirname, "../..")
const packages = path.join(root, "packages")
const config = getDefaultConfig(__dirname)

const local = {
    motion: path.join(packages, "motion"),
    "framer-motion": path.join(packages, "framer-motion"),
    "motion-dom": path.join(packages, "motion-dom"),
    "motion-utils": path.join(packages, "motion-utils"),
}

/**
 * Resolve Motion from this repo's built packages. Everything those packages
 * import (react, react-native, reanimated) resolves from this app, so
 * there's only one copy of each.
 */
config.watchFolders = [packages]
config.resolver.resolveRequest = (context, moduleName, platform) => {
    const name = moduleName.startsWith("@")
        ? moduleName.split("/").slice(0, 2).join("/")
        : moduleName.split("/")[0]

    if (local[name]) {
        return context.resolveRequest(
            context,
            local[name] + moduleName.slice(name.length),
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
