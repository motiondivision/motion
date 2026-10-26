import {
    createProjectionNode,
    HTMLProjectionNode,
    rootProjectionNode,
    visualElementStore,
} from "motion-dom"
import type { IProjectionNode } from "motion-dom"
import { act, Fragment, useRef } from "react"
import { LazyMotion, domAnimation, domMax, m, motion } from "../.."
import { SwitchLayoutGroupContext } from "../../context/SwitchLayoutGroupContext"
import { render } from "../../jest.setup"
import { MeasureLayout } from "../features/layout/MeasureLayout"
import { FeatureBundle } from "../features/types"

const projectionOf = (element: Element | null) =>
    visualElementStore.get(element!)?.projection as IProjectionNode | undefined

/**
 * Third parties pass their own feature bundles to LazyMotion, with any
 * class built by createProjectionNode (or a subclass of one) as the
 * layout feature's ProjectionNode.
 */
class CustomProjectionNode extends HTMLProjectionNode {}

const customBundle: FeatureBundle = {
    ...domAnimation,
    layout: { ProjectionNode: CustomProjectionNode, MeasureLayout },
}

describe("projection node creation", () => {
    /**
     * Feature definitions are global, so this runs before any test loads
     * the layout feature.
     */
    test("creates the projection node on a later render once layout features load", () => {
        const Component = ({ features }: { features: FeatureBundle }) => (
            <LazyMotion features={features}>
                <m.div id="box" layout />
            </LazyMotion>
        )

        const { container, rerender } = render(
            <Component features={domAnimation} />
        )
        const element = container.querySelector("#box")!
        const visualElement = visualElementStore.get(element)!

        expect(visualElement).toBeDefined()
        expect(visualElement.projection).toBeUndefined()

        rerender(<Component features={domMax} />)

        expect(visualElementStore.get(element)).toBe(visualElement)
        expect(visualElement.projection).toBeInstanceOf(HTMLProjectionNode)
        expect(visualElement.projection.options.layout).toBe(true)
    })

    test("uses the ProjectionNode of a custom feature bundle", () => {
        const { container } = render(
            <LazyMotion features={customBundle}>
                <m.div id="parent" layout>
                    <m.div id="child" layout="position" />
                </m.div>
            </LazyMotion>
        )

        const parent = projectionOf(container.querySelector("#parent"))!
        const child = projectionOf(container.querySelector("#child"))!

        expect(parent).toBeInstanceOf(CustomProjectionNode)
        expect(child).toBeInstanceOf(CustomProjectionNode)
        expect(parent.instance).toBe(container.querySelector("#parent"))
        expect(child.parent).toBe(parent)
        expect(parent.parent).toBe(rootProjectionNode.current)
        expect(parent.options.animationType).toBe("both")
        expect(child.options.animationType).toBe("position")
    })

    test("uses a ProjectionNode built with createProjectionNode", () => {
        const ProjectionNode = createProjectionNode<HTMLElement>({
            measureScroll: (instance) => ({
                x: instance.scrollLeft,
                y: instance.scrollTop,
            }),
            defaultParent: () => rootProjectionNode.current,
            resetTransform: (instance, value) => {
                instance.style.transform = value !== undefined ? value : "none"
            },
            checkIsScrollRoot: () => false,
        })

        const { container } = render(
            <LazyMotion
                features={{
                    ...domAnimation,
                    layout: { ProjectionNode, MeasureLayout },
                }}
            >
                <m.div id="box" layout />
            </LazyMotion>
        )

        const projection = projectionOf(container.querySelector("#box"))!
        expect(projection).toBeInstanceOf(ProjectionNode)
        expect(projection.options.layout).toBe(true)
    })

    test("passes layout and drag props to the projection node", () => {
        const Component = () => {
            const constraints = useRef(null)
            return (
                <motion.div ref={constraints}>
                    <motion.div
                        id="box"
                        layoutId="box"
                        layout="size"
                        layoutScroll
                        layoutRoot
                        layoutAnchor={{ x: 0.5, y: 0 }}
                        layoutCrossfade={false}
                        dragConstraints={constraints}
                    />
                    <motion.div id="plain" layout />
                    <motion.div id="drag" drag="x" />
                </motion.div>
            )
        }

        const { container } = render(<Component />)

        const element = container.querySelector("#box")!
        const box = projectionOf(element)!
        expect(box.options).toMatchObject({
            layoutId: "box",
            layout: "size",
            animationType: "size",
            alwaysMeasureLayout: true,
            crossfade: false,
            layoutScroll: true,
            layoutRoot: true,
            layoutAnchor: { x: 0.5, y: 0 },
        })
        expect(box.options.visualElement).toBe(visualElementStore.get(element))

        expect(
            projectionOf(container.querySelector("#plain"))!.options
                .alwaysMeasureLayout
        ).toBeFalsy()
        expect(
            projectionOf(container.querySelector("#drag"))!.options
                .alwaysMeasureLayout
        ).toBe(true)
    })

    test("passes SwitchLayoutGroupContext as initialPromotionConfig", () => {
        const promotion = { transition: { duration: 2 } }

        const { container } = render(
            <SwitchLayoutGroupContext.Provider value={promotion}>
                <motion.div id="box" layoutId="promoted" />
            </SwitchLayoutGroupContext.Provider>
        )

        const box = projectionOf(container.querySelector("#box"))!
        expect(box.options.initialPromotionConfig).toBe(promotion)
        expect(box.options.transition).toBe(promotion.transition)
    })

    test("skips parents that don't allow projection, and portals", () => {
        const MotionFragment = motion.create(Fragment)

        const { container } = render(
            <motion.div id="parent" layout>
                <MotionFragment>
                    <motion.div id="child" layout />
                </MotionFragment>
                <motion.div id="portal" layout data-framer-portal-id="a" />
            </motion.div>
        )

        const parent = projectionOf(container.querySelector("#parent"))!
        expect(projectionOf(container.querySelector("#child"))!.parent).toBe(
            parent
        )
        expect(projectionOf(container.querySelector("#portal"))!.parent).toBe(
            rootProjectionNode.current
        )
    })

    test("creates the projection node after async feature loading", async () => {
        let resolve!: (bundle: FeatureBundle) => void
        const features = new Promise<FeatureBundle>((r) => (resolve = r))

        const { container } = render(
            <LazyMotion features={() => features}>
                <m.div id="box" layout />
            </LazyMotion>
        )
        const element = container.querySelector("#box")!
        expect(visualElementStore.get(element)).toBeUndefined()

        await act(async () => {
            resolve(customBundle)
            await features
        })

        const projection = projectionOf(element)!
        expect(projection).toBeInstanceOf(CustomProjectionNode)
        expect(projection.options.layout).toBe(true)
    })
})
