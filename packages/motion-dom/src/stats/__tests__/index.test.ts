import { recordStats } from ".."
import { statsBuffer } from "../buffer"

describe("recordStats", () => {
    beforeEach(() => {
        statsBuffer.value = null
        statsBuffer.addProjectionMetrics = null
        statsBuffer.countProjection = undefined
    })

    it("throws if stats are already being measured", () => {
        recordStats()
        expect(() => recordStats()).toThrow()
    })

    it("initializes the layout projection buffer", () => {
        recordStats()

        expect(statsBuffer.value).not.toBeNull()
        expect(statsBuffer.value!.layoutProjection).toEqual({
            nodes: [],
            calculatedTargetDeltas: [],
            calculatedProjections: [],
        })
    })

    it("addProjectionMetrics appends per-frame metrics", () => {
        recordStats()

        statsBuffer.addProjectionMetrics!({
            nodes: 3,
            calculatedTargetDeltas: 2,
            calculatedProjections: 1,
        })
        statsBuffer.addProjectionMetrics!({
            nodes: 4,
            calculatedTargetDeltas: 0,
            calculatedProjections: 2,
        })

        expect(statsBuffer.value!.layoutProjection).toEqual({
            nodes: [3, 4],
            calculatedTargetDeltas: [2, 0],
            calculatedProjections: [1, 2],
        })
    })

    it("countProjection records each frame's counts and starts the next", () => {
        recordStats()

        const { countProjection } = statsBuffer
        countProjection!(0)
        countProjection!(0)
        countProjection!(1)
        countProjection!()
        countProjection!(2)
        countProjection!()

        expect(statsBuffer.value!.layoutProjection).toEqual({
            nodes: [2, 0],
            calculatedTargetDeltas: [1, 0],
            calculatedProjections: [0, 1],
        })
    })

    it("projection doesn't count when stats aren't recorded", () => {
        expect(statsBuffer.countProjection).toBeUndefined()
    })
})
