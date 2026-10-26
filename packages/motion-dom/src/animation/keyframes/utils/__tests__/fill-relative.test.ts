import { fillRelativeWildcards } from "../fill-relative"

test("fillRelativeWildcards fills null values with the previous value", () => {
    const keyframes = [100, null, 300]
    fillRelativeWildcards(keyframes)
    expect(keyframes).toEqual([100, 100, 300])
})

test("fillRelativeWildcards resolves relative keyframes against the previous value", () => {
    const keyframes = [100, "+=50", null, "-=25", "+=0.5"]
    fillRelativeWildcards(keyframes)
    expect(keyframes).toEqual([100, 150, 150, 125, 125.5])
})

test("fillRelativeWildcards keeps the unit of a relative keyframe or its origin", () => {
    const fromUnit = ["10px", "+=5"]
    fillRelativeWildcards(fromUnit)
    expect(fromUnit).toEqual(["10px", "15px"])

    const fromNumber = [0, "+=50%"]
    fillRelativeWildcards(fromNumber)
    expect(fromNumber).toEqual([0, "50%"])

    const negative = ["-10vw", "-=5vw"]
    fillRelativeWildcards(negative)
    expect(negative).toEqual(["-10vw", "-15vw"])
})

test("fillRelativeWildcards leaves other strings alone", () => {
    const keyframes = ["#fff", "#000", "calc(100% - 10px)", "-10px"]
    fillRelativeWildcards(keyframes)
    expect(keyframes).toEqual(["#fff", "#000", "calc(100% - 10px)", "-10px"])
})

test("fillRelativeWildcards doesn't read exponents as units", () => {
    const keyframes = [1e-7, "+=1", "+=1e3", "+=1.5em"]
    fillRelativeWildcards(keyframes)
    expect(keyframes).toEqual([1e-7, 1.0000001, 1001.0000001, "1002.5000001em"])
})
