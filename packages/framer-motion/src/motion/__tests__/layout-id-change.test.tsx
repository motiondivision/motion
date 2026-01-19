import { motion } from "framer-motion"
import * as React from "react"
import { render } from "../../jest.setup"

describe("layoutId changes", () => {
    it("allows layoutId to change dynamically", () => {
        const Component = ({ layoutId }: { layoutId: string }) => {
            return <motion.div layoutId={layoutId} data-testid="motion-div" />
        }

        const { rerender, getByTestId } = render(
            <Component layoutId="first-id" />
        )

        // Verify element exists
        expect(getByTestId("motion-div")).toBeTruthy()

        // Change layoutId
        rerender(<Component layoutId="second-id" />)

        // Element should still exist after layoutId change
        expect(getByTestId("motion-div")).toBeTruthy()
    })

    it("allows layoutId to change from undefined to a value", () => {
        const Component = ({ layoutId }: { layoutId: string | undefined }) => {
            return (
                <motion.div
                    layoutId={layoutId}
                    layout
                    data-testid="motion-div"
                />
            )
        }

        const { rerender, getByTestId } = render(
            <Component layoutId={undefined} />
        )

        expect(getByTestId("motion-div")).toBeTruthy()

        // Add layoutId
        rerender(<Component layoutId="new-id" />)

        expect(getByTestId("motion-div")).toBeTruthy()
    })

    it("allows layoutId to change from a value to undefined", () => {
        const Component = ({ layoutId }: { layoutId: string | undefined }) => {
            return (
                <motion.div
                    layoutId={layoutId}
                    layout
                    data-testid="motion-div"
                />
            )
        }

        const { rerender, getByTestId } = render(
            <Component layoutId="some-id" />
        )

        expect(getByTestId("motion-div")).toBeTruthy()

        // Remove layoutId
        rerender(<Component layoutId={undefined} />)

        expect(getByTestId("motion-div")).toBeTruthy()
    })

    it("multiple components can share and change layoutIds", async () => {
        const Component = ({
            layoutIdA,
            layoutIdB,
        }: {
            layoutIdA: string
            layoutIdB: string
        }) => {
            return (
                <>
                    <motion.div layoutId={layoutIdA} data-testid="div-a" />
                    <motion.div layoutId={layoutIdB} data-testid="div-b" />
                </>
            )
        }

        const { rerender, getByTestId } = render(
            <Component layoutIdA="shared" layoutIdB="other" />
        )

        expect(getByTestId("div-a")).toBeTruthy()
        expect(getByTestId("div-b")).toBeTruthy()

        // Swap layoutIds - div-b now has "shared", div-a has "other"
        rerender(<Component layoutIdA="other" layoutIdB="shared" />)

        expect(getByTestId("div-a")).toBeTruthy()
        expect(getByTestId("div-b")).toBeTruthy()
    })

    it("preserves layout attribute when layoutId changes", () => {
        const Component = ({
            layoutId,
            layout,
        }: {
            layoutId: string
            layout: boolean | "position" | "size"
        }) => {
            return (
                <motion.div
                    layoutId={layoutId}
                    layout={layout}
                    data-testid="motion-div"
                />
            )
        }

        const { rerender, getByTestId } = render(
            <Component layoutId="id-1" layout="position" />
        )

        expect(getByTestId("motion-div")).toBeTruthy()

        // Change both layoutId and layout
        rerender(<Component layoutId="id-2" layout="size" />)

        expect(getByTestId("motion-div")).toBeTruthy()
    })

    it("handles rapid layoutId changes", () => {
        const Component = ({ layoutId }: { layoutId: string }) => {
            return <motion.div layoutId={layoutId} data-testid="motion-div" />
        }

        const { rerender, getByTestId } = render(
            <Component layoutId="id-1" />
        )

        // Rapidly change layoutId multiple times
        rerender(<Component layoutId="id-2" />)
        rerender(<Component layoutId="id-3" />)
        rerender(<Component layoutId="id-4" />)
        rerender(<Component layoutId="id-1" />) // Back to original

        expect(getByTestId("motion-div")).toBeTruthy()
    })

    it("correctly handles layoutId changes with conditional rendering", () => {
        const Component = ({
            show,
            layoutId,
        }: {
            show: boolean
            layoutId: string
        }) => {
            return show ? (
                <motion.div layoutId={layoutId} data-testid="motion-div" />
            ) : null
        }

        const { rerender, queryByTestId } = render(
            <Component show={true} layoutId="id-1" />
        )

        expect(queryByTestId("motion-div")).toBeTruthy()

        // Change layoutId while visible
        rerender(<Component show={true} layoutId="id-2" />)
        expect(queryByTestId("motion-div")).toBeTruthy()

        // Hide
        rerender(<Component show={false} layoutId="id-2" />)
        expect(queryByTestId("motion-div")).toBeNull()

        // Show again with different layoutId
        rerender(<Component show={true} layoutId="id-3" />)
        expect(queryByTestId("motion-div")).toBeTruthy()
    })

    it("works correctly when layoutId changes to match another component", async () => {
        const Component = ({ selectedId }: { selectedId: string }) => {
            return (
                <>
                    <motion.div layoutId="item-1" data-testid="item-1">
                        {selectedId === "item-1" && (
                            <motion.span
                                layoutId="indicator"
                                data-testid="indicator"
                            />
                        )}
                    </motion.div>
                    <motion.div layoutId="item-2" data-testid="item-2">
                        {selectedId === "item-2" && (
                            <motion.span
                                layoutId="indicator"
                                data-testid="indicator"
                            />
                        )}
                    </motion.div>
                </>
            )
        }

        const { rerender, getByTestId } = render(
            <Component selectedId="item-1" />
        )

        expect(getByTestId("indicator")).toBeTruthy()

        // Move indicator to item-2
        rerender(<Component selectedId="item-2" />)

        expect(getByTestId("indicator")).toBeTruthy()
    })
})
