import { recordStats } from ".."
import { statsBuffer } from "../buffer"

describe("recordStats", () => {
    beforeEach(() => {
        statsBuffer.value = null
        statsBuffer.addProjectionMetrics = null
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
})
