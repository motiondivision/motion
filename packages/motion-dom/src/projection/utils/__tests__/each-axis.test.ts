import { eachAxis } from "../each-axis"

describe("eachAxis", () => {
    it("calls a function, once for each axis", () => {
        const output: string[] = []
        eachAxis((axis) => output.push(axis))
        expect(output).toEqual(["x", "y"])
    })
})
