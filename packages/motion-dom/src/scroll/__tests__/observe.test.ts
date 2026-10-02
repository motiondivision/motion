import * as motionDom from "../../index"

describe("observeTimeline", () => {
    test("is exported for framer-motion 13.0–13.4", () => {
        expect(motionDom).toHaveProperty("observeTimeline")
    })
})
