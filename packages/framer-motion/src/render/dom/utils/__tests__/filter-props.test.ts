import "../../../../jest.setup"
import * as fs from "fs"
import * as path from "path"

describe("filter-props", () => {
    it("does not load @emotion/is-prop-valid at runtime", () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, "../filter-props.ts"),
            "utf8"
        )

        expect(source).not.toContain("require(")
    })

    it("does not declare @emotion/is-prop-valid as an optional peer", () => {
        const packageJsonPaths = [
            path.resolve(__dirname, "../../../../../package.json"),
            path.resolve(__dirname, "../../../../../../motion/package.json"),
        ]

        packageJsonPaths.forEach((packageJsonPath) => {
            const packageJson = JSON.parse(
                fs.readFileSync(packageJsonPath, "utf8")
            )

            expect(
                packageJson.peerDependencies?.["@emotion/is-prop-valid"]
            ).toBeUndefined()
            expect(
                packageJson.peerDependenciesMeta?.["@emotion/is-prop-valid"]
            ).toBeUndefined()
        })
    })
})
