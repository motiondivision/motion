import { waitFor } from "@testing-library/dom"
import * as React from "react"
import { lazy, Suspense } from "react"
import { AnimateSuspense, motion } from "../../.."
import { render } from "../../../jest.setup"

/**
 * @jest-environment jsdom
 */
describe("AnimateSuspense", () => {
    test("renders children directly when they do not suspend", () => {
        const { container, queryByText } = render(
            <AnimateSuspense
                fallback={<div data-testid="fallback">Loading</div>}
            >
                <div data-testid="content">Content</div>
            </AnimateSuspense>
        )

        expect(queryByText("Content")).not.toBeNull()
        // Fallback must not be in the DOM when children resolve synchronously.
        expect(container.querySelector('[data-testid="fallback"]')).toBeNull()
    })

    test("renders fallback while children are suspended", async () => {
        let resolveLazy: () => void = () => {}
        const LazyChild = lazy(
            () =>
                new Promise<{ default: React.ComponentType }>((resolve) => {
                    resolveLazy = () =>
                        resolve({
                            default: () => (
                                <div data-testid="content">Loaded</div>
                            ),
                        })
                })
        )

        const { queryByText, queryByTestId } = render(
            <AnimateSuspense
                fallback={
                    <motion.div data-testid="fallback" exit={{ opacity: 0 }}>
                        Loading
                    </motion.div>
                }
            >
                <LazyChild />
            </AnimateSuspense>
        )

        // Fallback should be visible while suspended.
        await waitFor(() => {
            expect(queryByTestId("fallback")).not.toBeNull()
        })

        // Resolve the lazy import.
        resolveLazy()

        await waitFor(() => {
            expect(queryByText("Loaded")).not.toBeNull()
        })
    })

    test("accepts the same props shape as React.Suspense", () => {
        // Compile-time check: AnimateSuspense's required props match Suspense's.
        const fallback = <div>Loading</div>
        const children = <div>Hello</div>

        const _native = <Suspense fallback={fallback}>{children}</Suspense>
        const _animated = (
            <AnimateSuspense fallback={fallback}>{children}</AnimateSuspense>
        )
        expect(_native).toBeTruthy()
        expect(_animated).toBeTruthy()
    })
})
