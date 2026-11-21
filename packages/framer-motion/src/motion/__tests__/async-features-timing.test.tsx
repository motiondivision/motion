import { visualElementStore } from "motion-dom"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { render } from "../../jest.setup"
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
