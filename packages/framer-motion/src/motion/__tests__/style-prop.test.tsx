import { motion, MotionConfig, useMotionValue } from "../.."
import { nextMicrotask } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"

describe("style prop", () => {
    test("should remove non-set styles", () => {
        function Component({ style }: any) {
            return (
                <MotionConfig isStatic>
                    <motion.div data-testid="child" style={style} />
                </MotionConfig>
            )
        }

        const { getByTestId, rerender } = render(
            <Component style={{ position: "absolute" }} />
        )

        expect(getByTestId("child")).toHaveStyle("position: absolute")

        rerender(<Component style={{}} />)

        expect(getByTestId("child")).not.toHaveStyle("position: absolute")
    })

    test("should update transforms when passed a new value", async () => {
        const Component = ({ x = 0 }) => {
            return <motion.div style={{ x }} />
        }

        const { container, rerender } = render(<Component />)

        expect(container.firstChild as Element).toHaveStyle("transform: none")

        rerender(<Component x={1} />)

        await nextMicrotask()

        expect(container.firstChild as Element).toHaveStyle(
            "transform: translateX(1px)"
        )

        rerender(<Component x={0} />)

        await nextMicrotask()

        expect(container.firstChild as Element).toHaveStyle("transform: none")
    })

    test("doesn't update transforms that are handled by animation props", () => {
        const Component = ({ x = 0 }) => {
            return (
                <motion.div
                    initial={{ x: 1 }}
                    animate={{ x: 200 }}
                    style={{ x }}
                />
            )
        }

        const { container, rerender } = render(<Component />)

        expect(container.firstChild as Element).toHaveStyle(
            "transform: translateX(1px)"
        )

        rerender(<Component x={2} />)

        expect(container.firstChild as Element).not.toHaveStyle(
            "transform: translateX(2px)"
        )
    })

    test("should update when passed new MotionValue", async () => {
        const Component = ({ useX = false }) => {
            const x = useMotionValue(1)
            const y = useMotionValue(2)
            const z = useMotionValue(3)

            return (
                <motion.div
                    style={{
                        x: useX ? x : 0,
                        y: !useX ? y : 0,
                        z: !useX ? z : 0,
                    }}
                />
            )
        }

        const { container, rerender } = render(<Component />)
        expect(container.firstChild as Element).toHaveStyle(
            "transform: translateY(2px) translateZ(3px)"
        )

        rerender(<Component useX />)

        await nextMicrotask()

        expect(container.firstChild as Element).toHaveStyle(
            "transform: translateX(1px)"
        )

        rerender(<Component />)

        await nextMicrotask()

        expect(container.firstChild as Element).toHaveStyle(
            "transform: translateY(2px) translateZ(3px)"
        )
    })

    test("should update when swapping between motion value and static value", async () => {
        const Component = ({ useBackgroundColor = false }) => {
            const backgroundColor = useMotionValue("#fff")

            return (
                <motion.div
                    style={{
                        backgroundColor: useBackgroundColor
                            ? backgroundColor
                            : "#000",
                    }}
                />
            )
        }

        const { container, rerender } = render(<Component useBackgroundColor />)
        expect(container.firstChild as Element).toHaveStyle(
            "background-color: rgb(255, 255, 255)"
        )

        rerender(<Component />)

        await nextMicrotask()

        expect(container.firstChild as Element).toHaveStyle(
            "background-color: rgb(0, 0, 0)"
        )

        rerender(<Component useBackgroundColor />)

        await nextMicrotask()

        expect(container.firstChild as Element).toHaveStyle(
            "background-color: rgb(255, 255, 255)"
        )
    })
})
