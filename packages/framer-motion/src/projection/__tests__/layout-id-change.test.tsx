/**
 * #1411: a motion component's layoutId can change after it mounts. The
 * projection node must leave its old layoutId's stack and join the new one,
 * as if it had mounted with the new layoutId.
 *
 * Nodes are compared by identity, as Jest crashes trying to print one.
 */

import { createRef, StrictMode } from "react"
import { visualElementStore } from "motion-dom"
import { AnimatePresence } from "../../components/AnimatePresence"
import { LayoutGroup } from "../../components/LayoutGroup"
import { motion } from "../../render/components/motion"
import { render } from "../../jest.setup"
import { nextFrame } from "../../gestures/__tests__/utils"

const getNode = (element: HTMLElement) =>
    visualElementStore.get(element)!.projection!

describe("changing layoutId after mount (#1411)", () => {
    test("moves the node to the new layoutId's stack", async () => {
        const ref = createRef<HTMLDivElement>()
        const { rerender } = render(<motion.div ref={ref} layoutId="initial" />)
        const node = getNode(ref.current!)
        const { sharedNodes } = node.root!

        expect(sharedNodes.get("initial")!.lead === node).toBe(true)

        rerender(<motion.div ref={ref} layoutId="shared" />)
        await nextFrame()

        expect(node.getStack() === sharedNodes.get("shared")).toBe(true)
        expect(node.getStack()!.lead === node).toBe(true)
        expect((sharedNodes.get("initial")?.members ?? []).includes(node)).toBe(
            false
        )
    })

    test("can add and remove a layoutId", async () => {
        const ref = createRef<HTMLDivElement>()
        const { rerender } = render(<motion.div ref={ref} layout />)
        const node = getNode(ref.current!)
        const { sharedNodes } = node.root!

        rerender(<motion.div ref={ref} layout layoutId="added" />)
        await nextFrame()
        expect(sharedNodes.get("added")!.lead === node).toBe(true)

        rerender(<motion.div ref={ref} layout />)
        await nextFrame()
        expect((sharedNodes.get("added")?.members ?? []).includes(node)).toBe(
            false
        )
    })

    /**
     * A node that's already on screen takes over the new layoutId instantly,
     * rather than animating from the lead as a node mounting with it would.
     * The lead is hidden, as at the end of a crossfade, even if it doesn't
     * re-render (constant layoutDependency, or memoised).
     */
    test.each([undefined, 1])(
        "takes over the new layoutId's lead instantly (layoutDependency %s)",
        async (layoutDependency) => {
            const a = createRef<HTMLDivElement>()
            const b = createRef<HTMLDivElement>()
            const App = ({ id }: { id: string }) => (
                <>
                    <motion.div ref={a} layoutId={id} />
                    <motion.div
                        ref={b}
                        layoutId="shared"
                        layoutDependency={layoutDependency}
                    />
                </>
            )
            const { rerender } = render(<App id="initial" />)
            const nodeA = getNode(a.current!)
            const nodeB = getNode(b.current!)
            await nextFrame()

            expect(nodeB.getStack()!.lead === nodeB).toBe(true)

            rerender(<App id="shared" />)

            const stack = nodeA.root!.sharedNodes.get("shared")!
            expect(stack.lead === nodeA).toBe(true)
            expect(stack.prevLead === nodeB).toBe(true)
            expect(nodeA.resumeFrom).toBeUndefined()

            await nextFrame()
            expect(nodeA.currentAnimation).toBeUndefined()
            expect(a.current!.style.visibility).not.toBe("hidden")
            expect(b.current!.style.visibility).toBe("hidden")
        }
    )

    /**
     * MeasureLayout syncs its options on every update, so props like
     * layoutAnchor can change after mount.
     */
    test("keeps layoutAnchor in sync", () => {
        const ref = createRef<HTMLDivElement>()
        const { rerender } = render(
            <motion.div ref={ref} layout layoutAnchor={{ x: 0, y: 0 }} />
        )
        const node = getNode(ref.current!)
        expect(node.options.layoutAnchor).toEqual({ x: 0, y: 0 })

        rerender(<motion.div ref={ref} layout layoutAnchor={{ x: 1, y: 1 }} />)
        expect(node.options.layoutAnchor).toEqual({ x: 1, y: 1 })
    })

    test("namespaces the new layoutId by its LayoutGroup", async () => {
        const ref = createRef<HTMLDivElement>()
        const App = ({ id }: { id: string }) => (
            <LayoutGroup id="group">
                <motion.div ref={ref} layoutId={id} />
            </LayoutGroup>
        )
        const { rerender } = render(<App id="a" />)
        const node = getNode(ref.current!)
        const { sharedNodes } = node.root!

        rerender(<App id="b" />)
        await nextFrame()

        expect(sharedNodes.get("group-b")?.lead === node).toBe(true)
        expect((sharedNodes.get("group-a")?.members ?? []).includes(node)).toBe(
            false
        )
    })

    test("joins the new stack once in StrictMode", async () => {
        const ref = createRef<HTMLDivElement>()
        const { rerender } = render(
            <StrictMode>
                <motion.div ref={ref} layoutId="a" />
            </StrictMode>
        )
        const node = getNode(ref.current!)

        rerender(
            <StrictMode>
                <motion.div ref={ref} layoutId="b" />
            </StrictMode>
        )
        await nextFrame()

        const { members } = node.root!.sharedNodes.get("b")!
        expect(
            members.filter((member: unknown) => member === node).length
        ).toBe(1)
    })

    /**
     * With layoutCrossfade={false}, a new lead hides the previous one, as it
     * would usually be unmounting. One that keeps rendering without the
     * layoutId, or moves to another layoutId, must stay visible, whichever
     * order the two update in.
     */
    test.each([
        ["a", "b"],
        ["b", "a"],
    ])(
        "keeps an element visible after its layoutId moves to another (%s to %s)",
        async (from, to) => {
            const refs = {
                a: createRef<HTMLDivElement>(),
                b: createRef<HTMLDivElement>(),
            }
            const App = ({
                selected,
                other,
            }: {
                selected: string
                other?: string
            }) => (
                <>
                    {(["a", "b"] as const).map((id) => (
                        <motion.div
                            key={id}
                            ref={refs[id]}
                            layout
                            layoutCrossfade={false}
                            layoutId={selected === id ? "selected" : other}
                        />
                    ))}
                </>
            )
            const { rerender } = render(<App selected={from} />)
            const prev = refs[from as "a"].current!

            rerender(<App selected={to} />)
            await nextFrame()
            const visible = [prev.style.visibility]

            rerender(<App selected={from} />)
            await nextFrame()
            rerender(<App selected={to} other="other" />)
            await nextFrame()
            visible.push(prev.style.visibility)

            expect(visible).not.toContain("hidden")
        }
    )

    /**
     * Without `layout` or `drag`, MeasureLayout only renders while there's a
     * layoutId, but the node must still join and leave stacks.
     */
    test("joins and leaves a stack without the layout prop", async () => {
        const ref = createRef<HTMLDivElement>()
        const { rerender } = render(<motion.div ref={ref} />)
        const node = getNode(ref.current!)
        const { sharedNodes } = node.root!

        rerender(<motion.div ref={ref} layoutId="joined" />)
        await nextFrame()
        expect(sharedNodes.get("joined")?.lead === node).toBe(true)

        rerender(<motion.div ref={ref} />)
        await nextFrame()
        expect((sharedNodes.get("joined")?.members ?? []).includes(node)).toBe(
            false
        )
    })

    /**
     * Tabs: layoutId={selected ? "underline" : undefined}. The id moves from
     * one element to another in the same commit, so the new holder animates
     * from the old one, as it would if it had mounted, whichever order the
     * two update in. Both stay visible.
     */
    test.each([
        ["a", "b", true],
        ["b", "a", true],
        ["a", "b", undefined],
        ["b", "a", undefined],
    ])(
        "animates the layoutId from %s to %s (layout %s)",
        async (from, to, layout) => {
            const refs = {
                a: createRef<HTMLDivElement>(),
                b: createRef<HTMLDivElement>(),
            }
            const App = ({ selected }: { selected: string }) => (
                <>
                    {(["a", "b"] as const).map((id) => (
                        <motion.div
                            key={id}
                            ref={refs[id]}
                            layout={layout}
                            layoutId={selected === id ? "underline" : undefined}
                        />
                    ))}
                </>
            )
            const { rerender } = render(<App selected={from} />)
            await nextFrame()
            const prev = getNode(refs[from as "a"].current!)
            const next = getNode(refs[to as "a"].current!)

            rerender(<App selected={to} />)

            expect(next.getStack()?.lead === next).toBe(true)
            expect(next.resumeFrom === prev).toBe(true)

            await nextFrame()
            expect(refs.a.current!.style.visibility).not.toBe("hidden")
            expect(refs.b.current!.style.visibility).not.toBe("hidden")
            expect(refs[from as "a"].current!.style.opacity).not.toBe("0")
        }
    )
})

/**
 * A gallery: thumbnails "one" and "two" each have their own layoutId, and a
 * persistent, open detail card has layoutId={open}. When open changes from
 * "one" to "two", the card leaves stack "one" (so thumbnail one leads it
 * again, resuming from the card) and takes over stack "two" from thumbnail
 * two. The card switches instantly, as it's already open, and thumbnail two
 * follows it out of sight. Thumbnail one animates home from the card's box,
 * whatever joining stack "two" does to the card's own snapshot.
 *
 * JSDOM has no layout, so getBoundingClientRect reads each element's box
 * from its data-box attribute.
 */
describe("changing an open card's layoutId (#1411)", () => {
    const boxes = {
        one: [0, 0, 100, 50],
        two: [200, 0, 100, 50],
        card: [50, 200, 400, 300],
    }

    beforeEach(() => {
        jest.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(function (this: HTMLElement) {
            const [x, y, width, height] = boxes[
                this.dataset.box as keyof typeof boxes
            ] ?? [0, 0, 0, 0]
            return {
                x,
                y,
                left: x,
                top: y,
                width,
                height,
                right: x + width,
                bottom: y + height,
                toJSON() {},
            } as DOMRect
        })
    })

    afterEach(() => jest.restoreAllMocks())

    const transition = { type: "tween", ease: "linear", duration: 10 } as const

    const Gallery = ({ open }: { open?: string }) => (
        <>
            {(["one", "two"] as const).map((id) => (
                <motion.div
                    key={id}
                    id={id}
                    data-box={id}
                    layoutId={id}
                    transition={transition}
                />
            ))}
            {open && (
                <motion.div
                    id="card"
                    data-box="card"
                    layoutId={open}
                    transition={transition}
                />
            )}
        </>
    )

    const element = (id: string) => document.getElementById(id)!

    async function openThenChange() {
        const { rerender } = render(<Gallery />)
        await nextFrame()
        rerender(<Gallery open="one" />)
        await nextFrame()
        await nextFrame()

        const one = getNode(element("one"))
        const card = getNode(element("card"))
        // The card grows out of thumbnail one. Finish that.
        expect(card.currentAnimation).toBeDefined()
        card.currentAnimation!.complete()
        await nextFrame()

        const snapshots: Record<string, any> = {}
        for (const id of ["one", "card"]) {
            getNode(element(id)).addEventListener(
                "didUpdate",
                ({ snapshot }: any) => (snapshots[id] = snapshot)
            )
        }

        rerender(<Gallery open="two" />)
        await nextFrame()
        await nextFrame()

        return { one, two: getNode(element("two")), card, snapshots }
    }

    test("the old thumbnail resumes from the card's box", async () => {
        const { one, snapshots } = await openThenChange()

        expect(one.isLead()).toBe(true)
        expect(snapshots.one.measuredBox).toEqual({
            x: { min: 50, max: 450 },
            y: { min: 200, max: 500 },
        })
    })

    test("the card switches instantly and the new thumbnail is hidden", async () => {
        const { two, card, snapshots } = await openThenChange()

        expect(card.getStack()!.lead === card).toBe(true)
        expect(two.getStack() === card.getStack()).toBe(true)
        expect(snapshots.card.measuredBox).toEqual({
            x: { min: 50, max: 450 },
            y: { min: 200, max: 500 },
        })
        expect(card.currentAnimation).toBeUndefined()
        expect(element("card").style.visibility).not.toBe("hidden")
        expect(element("card").style.opacity).not.toBe("0")
        expect(element("two").style.visibility).toBe("hidden")
    })

    /**
     * A thumbnail gives its layoutId to a modal while it's open, and takes
     * it back when the modal closes. The modal is exiting, so it's still in
     * the stack, but the thumbnail must animate from it rather than take
     * over instantly, or the exit never completes.
     */
    test.each([undefined, true])(
        "takes a layoutId back from an exiting element (layout %s)",
        async (layout) => {
            const App = ({ open }: { open: boolean }) => (
                <>
                    <motion.div
                        id="one"
                        data-box="one"
                        layout={layout}
                        layoutId={open ? undefined : "hero"}
                        transition={transition}
                    />
                    <AnimatePresence>
                        {open && (
                            <motion.div
                                key="card"
                                id="card"
                                data-box="card"
                                layoutId="hero"
                                transition={transition}
                            />
                        )}
                    </AnimatePresence>
                </>
            )
            const { rerender } = render(<App open={false} />)
            await nextFrame()
            rerender(<App open />)
            await nextFrame()
            getNode(element("card")).currentAnimation?.complete()
            await nextFrame()

            const card = element("card")
            rerender(<App open={false} />)
            await nextFrame()
            await nextFrame()

            expect(getNode(element("one")).currentAnimation).toBeDefined()
            expect(card.style.visibility).not.toBe("hidden")
        }
    )

    /**
     * A thumbnail that follows an open card and then loses its layoutId
     * must show again, as it no longer follows anything.
     */
    test.each([undefined, false])(
        "shows a follower again once it loses its layoutId (crossfade %s)",
        async (layoutCrossfade) => {
            const App = ({ id, open }: { id?: string; open: boolean }) => (
                <>
                    <motion.div
                        id="one"
                        data-box="one"
                        layoutId={id}
                        layoutCrossfade={layoutCrossfade}
                        transition={transition}
                    />
                    {open && (
                        <motion.div
                            id="card"
                            data-box="card"
                            layoutId="x"
                            layoutCrossfade={layoutCrossfade}
                            transition={transition}
                        />
                    )}
                </>
            )
            const { rerender } = render(<App id="x" open={false} />)
            await nextFrame()
            rerender(<App id="x" open />)
            await nextFrame()
            getNode(element("card")).currentAnimation?.complete()
            await nextFrame()

            rerender(<App open />)
            await nextFrame()
            rerender(<App open={false} />)
            await nextFrame()

            const { style } = element("one")
            expect(style.visibility).not.toBe("hidden")
            expect(style.opacity).not.toBe("0")
            expect(style.pointerEvents).not.toBe("none")
        }
    )
})
