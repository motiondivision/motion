/** @jest-environment node */
import { existsSync, readdirSync, readFileSync } from "fs"
import { resolve } from "path"

/**
 * Internal packages must depend on each other at exact versions. A range
 * lets a pinned release (or a CDN build of one) load newer internals that
 * no longer export what it imports.
 */
const root = resolve(__dirname, "../../../..")
const readJSON = (path: string) => JSON.parse(readFileSync(path, "utf8"))

const workspaces: string[] = readJSON(resolve(root, "package.json")).workspaces

const manifests: any[] = workspaces.flatMap((glob) => {
    const dir = glob.replace("/*", "")
    return readdirSync(resolve(root, dir))
        .map((name) => resolve(root, dir, name, "package.json"))
        .filter(existsSync)
        .map(readJSON)
})

const versions = new Map<string, string>(
    manifests
        .filter((manifest) => !manifest.private)
        .map(({ name, version }) => [name, version])
)

const dependencyTypes = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
]

test.each(manifests.map((manifest) => [manifest.name, manifest]))(
    "%s depends on internal packages at their exact version",
    (_, manifest) => {
        for (const type of dependencyTypes) {
            for (const [name, spec] of Object.entries(manifest[type] ?? {})) {
                if (!versions.has(name)) continue
                expect(`${name}@${spec}`).toBe(`${name}@${versions.get(name)}`)
            }
        }
    }
)

test("lerna writes exact versions for internal dependencies", () => {
    expect(readJSON(resolve(root, "lerna.json")).command?.version?.exact).toBe(
        true
    )
})
