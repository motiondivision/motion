import "../../../../jest.setup"
import * as fs from "fs"
import * as path from "path"

describe("filter-props", () => {
    it("should not use statically-analyzable require for @emotion/is-prop-valid", () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, "../filter-props.ts"),
            "utf8"
        )
        // Webpack and other bundlers (e.g. Storybook) statically analyze
        // require() calls and fail at build time when the module isn't
        // installed — even if the require is inside a try-catch.
        // The optional dependency must be loaded via a non-analyzable pattern.
        expect(source).not.toMatch(
            /require\s*\(\s*["'`]@emotion\/is-prop-valid["'`]\s*\)/
        )
    })
})
