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

    test("Propagates parent isPresent through nested AnimatePresence", async () => {
        const promise = new Promise<void>((resolve) => {
            const presenceLog: { parent: boolean; child: boolean }[] = []
            let removeParent: CB | null = null

            const Child = () => {
                const [isPresent] = usePresence()
                presenceLog.push({
                    parent: presenceLog[presenceLog.length - 1]?.parent ?? true,
                    child: isPresent,
                })
                return <div data-testid="child" />
            }

            const Parent = () => {
                const [isPresent, safeToRemove] = usePresence()

                useEffect(() => {
                    if (safeToRemove) removeParent = safeToRemove
                }, [isPresent, safeToRemove])

                presenceLog.push({ parent: isPresent, child: true })

                return (
                    <AnimatePresence>
                        <Child key="child" />
                    </AnimatePresence>
                )
            }

            const App = ({ isVisible }: { isVisible: boolean }) => (
                <AnimatePresence>
                    {isVisible && <Parent key="parent" />}
                </AnimatePresence>
            )

            const { rerender } = render(<App isVisible />)

            rerender(<App isVisible={false} />)

            setTimeout(() => {
                const lastChildEntry = [...presenceLog]
                    .reverse()
                    .find((entry) => entry.child !== undefined)
                const lastParentEntry = [...presenceLog]
                    .reverse()
                    .find((entry) => entry.parent !== undefined)

                expect(lastParentEntry?.parent).toBe(false)
                expect(lastChildEntry?.child).toBe(false)

                if (removeParent) act(() => removeParent!())

                resolve()
            }, 50)
        })

        await promise
    })
})
