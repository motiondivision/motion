import "../../../../jest.setup"
import * as fs from "fs"
import * as path from "path"
import type { MotionProps } from "../../../../motion/types"
import { filterProps } from "../filter-props"

describe("filter-props", () => {
    it("forwards arbitrary non-Motion props by default", () => {
        const props = {
            id: "test",
            customAttribute: "value",
            animate: { opacity: 1 },
        } as MotionProps

        expect(filterProps(props, true, false)).toEqual({
            id: "test",
            customAttribute: "value",
        })
    })

    it("uses an injected validator for DOM props", () => {
        const onClick = () => {}
        const props = {
            id: "test",
            "data-foo": "bar",
            customAttribute: "value",
            animate: { opacity: 1 },
            onClick,
            onTap: () => {},
        } as MotionProps
        const isValidProp = (key: string) =>
            key === "id" || key === "data-foo"

        expect(filterProps(props, true, false, isValidProp)).toEqual({
            id: "test",
            "data-foo": "bar",
            onClick,
        })
    })

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
