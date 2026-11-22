import { act, forwardRef } from "react"
import { AnimatePresence, motion } from "../../.."
import { render } from "../../../jest.setup"

const exit = { opacity: 0, transition: { duration: 10 } }

describe("AnimatePresence inert exiting children", () => {
    test.each(["sync", "wait", "popLayout"] as const)(
        "sets inert on an exiting child in %s mode and removes it on re-entry",
        (mode) => {
            const Component = ({ isVisible }: { isVisible: boolean }) => (
                <AnimatePresence mode={mode}>
                    {isVisible && (
                        <motion.div key="a" data-testid="a" exit={exit} />
                    )}
                </AnimatePresence>
            )

            const { getByTestId, rerender } = render(<Component isVisible />)
            const element = getByTestId("a")
            expect(element.hasAttribute("inert")).toBe(false)

            act(() => rerender(<Component isVisible={false} />))
            expect(getByTestId("a")).toBe(element)
            expect(element.hasAttribute("inert")).toBe(true)

            act(() => rerender(<Component isVisible />))
            expect(getByTestId("a")).toBe(element)
            expect(element.hasAttribute("inert")).toBe(false)
        }
    )

    test("sets inert on the outer element a popLayout child forwards its ref to", () => {
        const Card = forwardRef<HTMLDivElement>((_, ref) => (
            <div ref={ref} data-testid="outer">
                <motion.div data-testid="inner" exit={exit} />
            </div>
        ))

        const Component = ({ isVisible }: { isVisible: boolean }) => (
            <AnimatePresence mode="popLayout">
                {isVisible && <Card key="a" />}
            </AnimatePresence>
        )

        const { getByTestId, rerender } = render(<Component isVisible />)
        act(() => rerender(<Component isVisible={false} />))
        expect(getByTestId("outer").hasAttribute("inert")).toBe(true)
    })

    test("sets inert on the motion element of a child that doesn't forward refs", () => {
        const Card = () => <motion.div data-testid="inner" exit={exit} />

        const Component = ({ isVisible }: { isVisible: boolean }) => (
            <AnimatePresence mode="popLayout">
                {isVisible && <Card key="a" />}
            </AnimatePresence>
        )

        const { getByTestId, rerender } = render(<Component isVisible />)
        act(() => rerender(<Component isVisible={false} />))
        expect(getByTestId("inner").hasAttribute("inert")).toBe(true)
    })

    test("keeps an inert attribute the child already had after re-entry", () => {
        const Component = ({ isVisible }: { isVisible: boolean }) => (
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        key="a"
                        data-testid="a"
                        // React 18 only renders inert from a string
                        {...({ inert: "" } as {})}
                        exit={exit}
                    />
                )}
            </AnimatePresence>
        )

        const { getByTestId, rerender } = render(<Component isVisible />)
        act(() => rerender(<Component isVisible={false} />))
        expect(getByTestId("a").hasAttribute("inert")).toBe(true)
        act(() => rerender(<Component isVisible />))
        expect(getByTestId("a").hasAttribute("inert")).toBe(true)
    })

    test("sets inert on exiting children of nested AnimatePresence", () => {
        const Component = ({
            outer,
            inner,
        }: {
            outer: boolean
            inner: boolean
        }) => (
            <AnimatePresence>
                {outer && (
                    <motion.div key="outer" data-testid="outer" exit={exit}>
                        <AnimatePresence>
                            {inner && (
                                <motion.div
                                    key="inner"
                                    data-testid="inner"
                                    exit={exit}
                                />
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        )

        const { getByTestId, rerender } = render(<Component outer inner />)
        act(() => rerender(<Component outer inner={false} />))
        expect(getByTestId("inner").hasAttribute("inert")).toBe(true)
        expect(getByTestId("outer").hasAttribute("inert")).toBe(false)

        act(() => rerender(<Component outer={false} inner={false} />))
        expect(getByTestId("outer").hasAttribute("inert")).toBe(true)
    })
})
