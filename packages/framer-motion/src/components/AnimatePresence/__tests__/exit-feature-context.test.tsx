import { motionValue } from "motion-dom"
import { MotionGlobalConfig } from "motion-utils"
import { act } from "react"
import { stepFrames } from "../../../gestures/__tests__/utils"
import { render } from "../../../jest.setup"
import { AnimationFeature } from "../../../motion/features/animation"
import { createDomVisualElement } from "../../../render/dom/create-visual-element"
import { m } from "../../../render/components/m/proxy"
import { LazyMotion } from "../../LazyMotion"
import { AnimatePresence } from "../index"

afterEach(() => {
    MotionGlobalConfig.useManualTiming = false
})

describe("AnimatePresence provides the exit feature", () => {
    test("Animates exit when the loaded features have no exit feature", async () => {
        MotionGlobalConfig.useManualTiming = true
        const opacity = motionValue(1)

        const features = {
            renderer: createDomVisualElement,
            animation: { Feature: AnimationFeature },
        }

        const Component = ({ isVisible }: { isVisible: boolean }) => (
            <LazyMotion features={features}>
                <AnimatePresence>
                    {isVisible && (
                        <m.div
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.1, ease: "linear" }}
                            style={{ opacity }}
                        />
                    )}
                </AnimatePresence>
            </LazyMotion>
        )

        const { container, rerender } = render(<Component isVisible />)
        rerender(<Component isVisible />)

        await act(async () => {
            rerender(<Component isVisible={false} />)
        })

        await stepFrames(50)
        expect(container.firstChild).toBeTruthy()
        expect(opacity.get()).not.toBe(1)
        expect(opacity.get()).not.toBe(0)

        await stepFrames(100)
        expect(container.firstChild).toBeFalsy()
    })
})
