import { act, useEffect } from "react"
import { AnimatePresence } from ".."
import { render } from "../../../jest.setup"
import { usePresence } from "../use-presence"

type CB = () => void

describe("usePresence", () => {
    test("Can defer unmounting", async () => {
        const promise = new Promise<void>((resolve) => {
            let remove: CB

            const Child = () => {
                const [isPresent, safeToRemove] = usePresence()

                useEffect(() => {
                    if (safeToRemove) remove = safeToRemove
                }, [isPresent, safeToRemove])

                return <div />
            }

            const Parent = ({ isVisible }: { isVisible: boolean }) => (
                <AnimatePresence>{isVisible && <Child />}</AnimatePresence>
            )

            const { container, rerender } = render(<Parent isVisible />)

            rerender(<Parent isVisible={false} />)

            expect(container.firstChild).toBeTruthy()

            act(() => remove())

            setTimeout(() => {
                expect(container.firstChild).toBeFalsy()

                resolve()
            }, 150)
        })

        await promise
    })

    test("Multiple children can exit", async () => {
        const promise = new Promise<void>((resolve) => {
            let removeA: CB
            let removeB: CB

            const ChildA = () => {
                const [isPresent, safeToRemove] = usePresence()

                useEffect(() => {
                    if (safeToRemove) removeA = safeToRemove
                }, [isPresent, safeToRemove])

                return <div />
            }

            const ChildB = () => {
                const [isPresent, safeToRemove] = usePresence()

                useEffect(() => {
                    if (safeToRemove) removeB = safeToRemove
                }, [isPresent, safeToRemove])

                return <div />
            }

            const Parent = ({ isVisible }: { isVisible: boolean }) => (
                <AnimatePresence>
                    {isVisible && (
                        <div>
                            <ChildA />
                            <ChildB />
                        </div>
                    )}
                </AnimatePresence>
            )

            const { container, rerender } = render(<Parent isVisible />)
            rerender(<Parent isVisible={false} />)

            expect(container.firstChild).toBeTruthy()

            act(() => removeA())

            setTimeout(() => {
                expect(container.firstChild).toBeTruthy()

                act(() => removeB())

                setTimeout(() => {
                    expect(container.firstChild).toBeFalsy()

                    resolve()
                }, 100)
            }, 100)
        })

        await promise
    })

    test("Multiple children can exit over multiple rerenders", async () => {
        const promise = new Promise<void>((resolve) => {
            let removeA: CB
            let removeB: CB

            const ChildA = () => {
                const [isPresent, safeToRemove] = usePresence()

                useEffect(() => {
                    if (safeToRemove) removeA = safeToRemove
                }, [isPresent, safeToRemove])

                return <div />
            }

            const ChildB = () => {
                const [isPresent, safeToRemove] = usePresence()

                useEffect(() => {
                    if (safeToRemove) removeB = safeToRemove
                }, [isPresent, safeToRemove])

                return <div />
            }

            const Parent = ({ isVisible }: { isVisible: boolean }) => (
                <AnimatePresence>
                    {isVisible && (
                        <div>
                            <ChildA />
                            <ChildB />
                        </div>
                    )}
                </AnimatePresence>
            )

            const { container, rerender } = render(<Parent isVisible />)
            rerender(<Parent isVisible={false} />)

            expect(container.firstChild).toBeTruthy()

            act(() => removeA())

            setTimeout(() => {
                rerender(<Parent isVisible={false} />)

                setTimeout(() => {
                    expect(container.firstChild).toBeTruthy()
                    rerender(<Parent isVisible={false} />)
                    act(() => removeB())

                    setTimeout(() => {
                        expect(container.firstChild).toBeFalsy()

                        resolve()
                    }, 100)
                }, 100)
            }, 100)
        })

        await promise
    })

    test("Calling safeToRemove multiple times only triggers exit once", async () => {
        const promise = new Promise<void>((resolve) => {
            let safeToRemoveRef: CB
            let onExitCompleteCount = 0

            const Child = () => {
                const [isPresent, safeToRemove] = usePresence()

                useEffect(() => {
                    if (safeToRemove) safeToRemoveRef = safeToRemove
                }, [isPresent, safeToRemove])

                return <div />
            }

            const Parent = ({ isVisible }: { isVisible: boolean }) => (
                <AnimatePresence onExitComplete={() => onExitCompleteCount++}>
                    {isVisible && <Child />}
                </AnimatePresence>
            )

            const { container, rerender } = render(<Parent isVisible />)

            rerender(<Parent isVisible={false} />)

            // Simulate rapid events calling safeToRemove multiple times
            act(() => {
                safeToRemoveRef()
                safeToRemoveRef()
                safeToRemoveRef()
            })

            setTimeout(() => {
                // onExitComplete should only be called once
                expect(onExitCompleteCount).toBe(1)
                // Child should be removed
                expect(container.firstChild).toBeFalsy()
                resolve()
            }, 150)
        })

        await promise
    })

    test("Rapid rerenders during exit only triggers exit once", async () => {
        const promise = new Promise<void>((resolve) => {
            let safeToRemoveRef: CB
            let onExitCompleteCount = 0

            const Child = () => {
                const [isPresent, safeToRemove] = usePresence()

                useEffect(() => {
                    if (safeToRemove) safeToRemoveRef = safeToRemove
                }, [isPresent, safeToRemove])

                return <div />
            }

            const Parent = ({ isVisible }: { isVisible: boolean }) => (
                <AnimatePresence onExitComplete={() => onExitCompleteCount++}>
                    {isVisible && <Child />}
                </AnimatePresence>
            )

            const { container, rerender } = render(<Parent isVisible />)

            // Rapid re-renders with isVisible={false}
            rerender(<Parent isVisible={false} />)
            rerender(<Parent isVisible={false} />)
            rerender(<Parent isVisible={false} />)

            // Now call safeToRemove
            act(() => safeToRemoveRef())

            setTimeout(() => {
                // onExitComplete should only be called once
                expect(onExitCompleteCount).toBe(1)
                // Child should be removed
                expect(container.firstChild).toBeFalsy()
                resolve()
            }, 150)
        })

        await promise
    })

    test("Component can exit again after re-entering", async () => {
        const promise = new Promise<void>((resolve) => {
            let safeToRemoveRef: CB
            let onExitCompleteCount = 0

            const Child = () => {
                const [isPresent, safeToRemove] = usePresence()

                useEffect(() => {
                    if (safeToRemove) safeToRemoveRef = safeToRemove
                }, [isPresent, safeToRemove])

                return <div />
            }

            const Parent = ({ isVisible }: { isVisible: boolean }) => (
                <AnimatePresence onExitComplete={() => onExitCompleteCount++}>
                    {isVisible && <Child />}
                </AnimatePresence>
            )

            const { container, rerender } = render(<Parent isVisible />)

            // First exit
            rerender(<Parent isVisible={false} />)
            act(() => safeToRemoveRef())

            setTimeout(() => {
                expect(onExitCompleteCount).toBe(1)
                expect(container.firstChild).toBeFalsy()

                // Re-enter
                rerender(<Parent isVisible />)

                setTimeout(() => {
                    expect(container.firstChild).toBeTruthy()

                    // Second exit
                    rerender(<Parent isVisible={false} />)
                    act(() => safeToRemoveRef())

                    setTimeout(() => {
                        // onExitComplete should be called twice (once per exit cycle)
                        expect(onExitCompleteCount).toBe(2)
                        expect(container.firstChild).toBeFalsy()
                        resolve()
                    }, 150)
                }, 150)
            }, 150)
        })

        await promise
    })
})
