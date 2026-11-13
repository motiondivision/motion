/**
 * The code that makes a shared animation follow a timeline is kept out of
 * bundles that never attach one. A Timeline loads it as it attaches, so it
 * works for animations that animate() didn't make.
 */
test("a Timeline attaches animations that animate() didn't make", () => {
    jest.isolateModules(() => {
        const { animateMotionValue, motionValue } = require("motion-dom")
        const { Timeline } = require("..")

        const value = motionValue(0)
        const animation = animateMotionValue("x", value, 100, {
            duration: 1,
            ease: "linear",
        })(() => {})

        const timeline = new Timeline([], {}, [animation])
        const observe = jest.fn(() => () => {})

        expect(() => timeline.attachTimeline({ observe })).not.toThrow()
        expect(observe).toHaveBeenCalled()

        timeline.stop()
    })
})
