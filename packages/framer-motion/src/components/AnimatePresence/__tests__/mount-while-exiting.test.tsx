import { act, Suspense, useState } from "react"
import { AnimatePresence, motion, useIsPresent } from "../../.."
import { nextFrame } from "../../../gestures/__tests__/utils"
import { render } from "../../../jest.setup"

interface Item {
    name: string
    hasAction: boolean
}

const isExit = (definition: any) => definition.opacity === 0

async function waitForRemoval(query: () => Element | null) {
    for (let i = 0; i < 60 && query(); i++) await act(nextFrame)
}

/**
 * #4049: A Suspense boundary that's already showing content suspends again,
 * and the render that reveals it removes a child of AnimatePresence. React
 * detaches the hidden tree's refs while it's suspended and attaches them
 * again on reveal, so the exiting child mounts again already exiting.
 */
function renderItems(isStrict: boolean) {
    const cache = new Map<string, Item>([
        ["A", { name: "A", hasAction: true }],
        ["B", { name: "B", hasAction: false }],
    ])
    let resolveItem = () => {}
    let pending: Promise<void> | undefined

    const read = (id: string) => {
        const item = cache.get(id)
        if (item) return item

        throw (pending ||= new Promise<void>((resolve) => {
            resolveItem = () => {
                cache.set(id, { name: id, hasAction: false })
                resolve()
            }
        }))
    }

    const onAnimationStart = jest.fn()

    const Details = ({ id }: { id: string }) => {
        const item = read(id)

        return (
            <div>
                <p>Item {item.name}</p>
                <AnimatePresence>
                    {item.hasAction && (
                        <motion.button
                            key="action"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.05 }}
                            onAnimationStart={onAnimationStart}
                        >
                            Action for {item.name}
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>
        )
    }

    let select = (_id: string) => {}

    const App = () => {
        const [id, setId] = useState("A")
        select = setId

        return (
            <Suspense fallback={<p>Loading…</p>}>
                <Details id={id} />
            </Suspense>
        )
    }

    const result = render(<App />, isStrict)

    return {
        ...result,
        action: () => result.queryByText("Action for A"),
        exitStarted: () => onAnimationStart.mock.calls.some(([d]) => isExit(d)),
        select: (id: string) => act(() => select(id)),
        resolve: () => act(async () => resolveItem()),
    }
}

describe.each([true, false])(
    "AnimatePresence child that mounts already exiting (StrictMode: %s)",
    (isStrict) => {
        test("exits when removed without suspending", async () => {
            const { action, getByText, exitStarted, select } =
                renderItems(isStrict)

            for (let i = 0; i < 10; i++) await act(nextFrame)

            await select("B")
            expect(getByText("Item B")).toBeInTheDocument()

            await waitForRemoval(action)

            expect(exitStarted()).toBe(true)
            expect(action()).toBeNull()
        })

        test("exits when removed by the render that reveals a Suspense boundary", async () => {
            const { action, getByText, exitStarted, select, resolve } =
                renderItems(isStrict)

            // Wait for the enter animation to finish
            for (let i = 0; i < 10; i++) await act(nextFrame)

            await select("C")
            expect(getByText("Loading…")).toBeInTheDocument()

            await resolve()
            expect(getByText("Item C")).toBeInTheDocument()

            await waitForRemoval(action)

            expect(exitStarted()).toBe(true)
            expect(action()).toBeNull()
        })

        test("a motion component first rendered by an exiting child exits", async () => {
            const onAnimationStart = jest.fn()

            const Child = () => {
                const isPresent = useIsPresent()

                return (
                    <div>
                        <motion.div
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.05 }}
                        />
                        {!isPresent && (
                            <motion.div
                                data-testid="late"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.05 }}
                                onAnimationStart={onAnimationStart}
                            />
                        )}
                    </div>
                )
            }

            let setShow = (_show: boolean) => {}

            const App = () => {
                const [show, set] = useState(true)
                setShow = set

                return (
                    <AnimatePresence>
                        {show && <Child key="child" />}
                    </AnimatePresence>
                )
            }

            const { queryByTestId } = render(<App />, isStrict)
            const late = () => queryByTestId("late")

            await act(nextFrame)
            act(() => setShow(false))
            expect(late()).toBeInTheDocument()

            await waitForRemoval(late)

            expect(onAnimationStart.mock.calls.some(([d]) => isExit(d))).toBe(
                true
            )
            expect(late()).toBeNull()
        })
    }
)
