import { fillWildcards } from "../fill-wildcards"

test("fillWildcards fills null values with the previous value", () => {
    const keyframes = [100, null, 300]
    fillWildcards(keyframes)
    expect(keyframes).toEqual([100, 100, 300])
})

test("fillWildcards handles single keyframe", () => {
    const keyframes = [null]
    fillWildcards(keyframes)
    expect(keyframes).toEqual([null])
    const keyframes2 = [100]
    fillWildcards(keyframes2)
    expect(keyframes2).toEqual([100])
})

test("fillWildcards handles multiple keyframes", () => {
    const keyframes = [1, null, null]
    fillWildcards(keyframes)
    expect(keyframes).toEqual([1, 1, 1])
})
