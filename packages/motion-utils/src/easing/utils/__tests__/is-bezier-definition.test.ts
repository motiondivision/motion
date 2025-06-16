import { isBezierDefinition } from "../is-bezier-definition"

test("isBezierDefinition", () => {
    expect(isBezierDefinition("linear")).toEqual(false)
    expect(isBezierDefinition((v) => v)).toEqual(false)
    expect(isBezierDefinition(["linear"])).toEqual(false)
    expect(isBezierDefinition([0, 1, 2, 3])).toEqual(true)
    expect(isBezierDefinition([0, 1, 2, 3] as const)).toEqual(true)
})
