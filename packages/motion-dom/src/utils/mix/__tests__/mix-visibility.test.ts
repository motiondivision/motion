import { mixVisibility } from "../visibility"

describe("mixVisibility", () => {
    test("mixes binary visibility", () => {
        expect(mixVisibility("visible", "hidden")(0)).toBe("visible")
        expect(mixVisibility("visible", "hidden")(0.5)).toBe("visible")
        expect(mixVisibility("visible", "hidden")(1)).toBe("hidden")
        expect(mixVisibility("hidden", "visible")(0)).toBe("hidden")
        expect(mixVisibility("hidden", "visible")(0.5)).toBe("visible")
        expect(mixVisibility("hidden", "visible")(1)).toBe("visible")
        expect(mixVisibility("block", "none")(0)).toBe("block")
        expect(mixVisibility("block", "none")(0.5)).toBe("block")
        expect(mixVisibility("block", "none")(1)).toBe("none")
        expect(mixVisibility("none", "block")(0)).toBe("none")
        expect(mixVisibility("none", "block")(0.5)).toBe("block")
        expect(mixVisibility("none", "block")(1)).toBe("block")
    })
})
