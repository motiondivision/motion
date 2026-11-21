import { visualElementStore } from "motion-dom"
import { act, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { render } from "../../jest.setup"
import { getInitializedFeatureDefinitions } from "../features/definitions"
import { drag } from "../features/drag"
import { layout } from "../features/layout"
import { loadFeatures } from "../features/load-features"
import { featureLoaders } from "../../render/components/motion-async/loaders"
import { motion } from "../../render/components/motion-async/proxy"

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

describe("async features that arrive at awkward times", () => {
    test("a node made on a render that changes variant labels is mounted", async () => {
        const Component = ({ label }: { label: string }) => (
            <motion.div id="parent" animate={label}>
                <motion.div id="child" />
            </motion.div>
        )

        const { container, rerender } = render(<Component label="a" />)
        const get = (id: string) =>
            visualElementStore.get(container.querySelector("#" + id)!)!
                .projection

        /**
         * The feature arrives from elsewhere, and the first render after
         * it gives the parent a new context.
         */
        featureLoaders.layout.isLoaded = false
        loadFeatures(layout)
        rerender(<Component label="b" />)
        await act(async () => {
            await wait()
        })

        expect(get("parent").instance === container.firstChild).toBe(true)
        expect(get("child").parent === get("parent")).toBe(true)
        expect(get("child").instance).toBeTruthy()
    })

    test("a feature that arrives between a component's render and its effects is mounted", async () => {
        /**
         * Already fetched, as when the chunk is cached, so it arrives
         * in a microtask after the commit and before passive effects.
         */
        featureLoaders.drag.load = () => Promise.resolve(drag)

        const container = document.createElement("div")
        document.body.appendChild(container)
        const root = createRoot(container)
        root.render(<motion.div drag />)

        for (let i = 0; i < 5; i++) await wait(10)

        const visualElement = visualElementStore.get(
            container.firstChild as Element
        )!
        expect(featureLoaders.drag.isLoaded).toBe(true)
        expect(visualElement.projection).toBeTruthy()
        expect(visualElement.features.drag).toBeTruthy()

        await act(async () => root.unmount())
    })
})

describe("async features and Suspense", () => {
    test("features that arrive while a boundary hides its elements work once shown", async () => {
        /**
         * Start again with nothing loaded, and loaders that the test
         * resolves.
         */
        let arrive!: VoidFunction
        const held = new Promise<void>((resolve) => (arrive = resolve))
        const definitions = getInitializedFeatureDefinitions() as any
        for (const key of ["layout", "drag", "pan"]) {
            definitions[key] = { isEnabled: definitions[key].isEnabled }
        }
        featureLoaders.layout.isLoaded = featureLoaders.drag.isLoaded = false
        featureLoaders.layout.promise = featureLoaders.drag.promise = undefined
        featureLoaders.layout.load = () => held.then(() => layout)
        featureLoaders.drag.load = () => held.then(() => drag)

        let show!: VoidFunction
        const shown = new Promise<void>((resolve) => (show = resolve))
        let isShown = false
        shown.then(() => (isShown = true))
        const Suspends = ({ suspend }: { suspend: boolean }) => {
            if (suspend && !isShown) throw shown
            return null
        }

        const Component = ({ suspend = false }) => (
            <Suspense fallback={<div id="fallback" />}>
                <motion.div id="parent">
                    <motion.div id="layout" layout />
                    <motion.div id="drag" drag />
                </motion.div>
                <Suspends suspend={suspend} />
            </Suspense>
        )

        const { container, rerender } = render(<Component />)
        const get = (id: string) =>
            visualElementStore.get(container.querySelector("#" + id)!)!

        /**
         * Hide the mounted elements, then let the features arrive.
         */
        rerender(<Component suspend />)
        expect(container.querySelector("#fallback")).toBeTruthy()
        await act(async () => {
            arrive()
            await wait()
        })
        expect(featureLoaders.layout.isLoaded).toBe(true)

        await act(async () => {
            show()
            await wait()
        })
        expect(container.querySelector("#fallback")).toBeNull()

        const parent = get("parent").projection
        expect(parent.instance === container.querySelector("#parent")).toBe(
            true
        )
        expect(get("layout").projection.parent === parent).toBe(true)
        expect(
            get("layout").projection.instance ===
                container.querySelector("#layout")
        ).toBe(true)

        /**
         * MeasureLayout has mounted, and the drag gesture.
         */
        expect(get("layout").projection.hasListeners("animationComplete")).toBe(
            true
        )
        expect(get("drag").features.drag).toBeTruthy()
    })
})
