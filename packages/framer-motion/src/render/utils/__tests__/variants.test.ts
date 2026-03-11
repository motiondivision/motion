import { resolveVariantFromProps } from "motion-dom"

describe("resolveVariantFromProps", () => {
    test("Resolves string", () => {
        const resolved = resolveVariantFromProps(
            { variants: { hidden: { opacity: 0 } } },
            "hidden"
        )

        expect(resolved).toEqual({ opacity: 0 })
    })

    test("Resolves function that returns object", () => {
        const resolved = resolveVariantFromProps(
            { variants: { hidden: { opacity: 0 } } },
            () => ({ opacity: 1 })
        )

        expect(resolved).toEqual({ opacity: 1 })
    })

    test("Resolves function that returns string", () => {
        const resolved = resolveVariantFromProps(
            { variants: { hidden: { opacity: 0 } } },
            () => "hidden"
        )

        expect(resolved).toEqual({ opacity: 0 })
    })
})
