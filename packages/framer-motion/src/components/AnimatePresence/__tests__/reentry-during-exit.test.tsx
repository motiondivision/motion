import { MotionGlobalConfig } from "motion-utils"
import { act, useEffect, useState } from "react"
import { AnimatePresence, motion } from "../../.."
import { render } from "../../../jest.setup"

const frame = () => new Promise<void>((resolve) => setTimeout(resolve, 40))

describe("AnimatePresence re-entry during exit", () => {
    beforeEach(() => {
        MotionGlobalConfig.instantAnimations = true
    })
    afterEach(() => {
        MotionGlobalConfig.instantAnimations = false
    })

    test("first child of initial={false} doesn't get stuck at initial when its previous exit resolved after re-entry", async () => {
        let setMode: (m: "bar" | "panel") => void = () => {}

        const Island = () => {
            const [mode, set] = useState<"bar" | "panel">("bar")
            useEffect(() => {
                setMode = set
            }, [])
            return (
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                        key={mode}
                        data-testid={mode}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                    />
                </AnimatePresence>
            )
        }

        const { getByTestId } = render(<Island />)
        const bar = () => getByTestId("bar") as HTMLElement

        // Exit resolves on the next frame, after the element has re-entered
        act(() => setMode("panel"))
        act(() => setMode("bar"))
        await act(frame)
        expect(bar().style.opacity).toBe("1")

        act(() => setMode("panel"))
        act(() => setMode("bar"))
        await act(frame)
        await act(frame)

        expect(bar().style.opacity).toBe("1")
        expect(bar().style.transform === "none" || bar().style.transform === "").toBe(true)
    })

    test("first child of initial={false} replays its enter when re-entering after its exit completed", async () => {
        MotionGlobalConfig.instantAnimations = false

        const Component = ({ isVisible }: { isVisible: boolean }) => (
            <AnimatePresence initial={false}>
                {isVisible && (
                    <div key="group">
                        <motion.div
                            data-testid="fast"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, transition: { duration: 0.05 } }}
                            transition={{ duration: 0.05 }}
                        />
                        <motion.div
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, transition: { duration: 10 } }}
                        />
                    </div>
                )}
            </AnimatePresence>
        )

        const { getByTestId, rerender } = render(<Component isVisible />)
        const fast = () => getByTestId("fast") as HTMLElement
        expect(fast().style.opacity).toBe("1")

        rerender(<Component isVisible={false} />)
        await act(() => new Promise((resolve) => setTimeout(resolve, 200)))
        expect(fast().style.opacity).toBe("0")

        rerender(<Component isVisible />)
        await act(() => new Promise((resolve) => setTimeout(resolve, 200)))
        expect(fast().style.opacity).toBe("1")
    })
})
