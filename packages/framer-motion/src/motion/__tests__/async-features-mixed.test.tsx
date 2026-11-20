import { visualElementStore } from "motion-dom"
import { act } from "react"
import { render } from "../../jest.setup"
import { motion as asyncMotion } from "../../render/components/motion-async/proxy"
import { motion } from "../../render/components/motion/proxy"

const settle = async () => {
    for (let i = 0; i < 5; i++) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0))
        })
    }
}

const projectionOf = (element: Element) =>
    visualElementStore.get(element)!.projection

describe("async components around one that bundles its features", () => {
    test("ancestors that rendered before the features arrived join the tree first", async () => {
        /**
         * The bundled features load when this first renders, after the
         * components above it have rendered without them.
         */
        const Bundled = () => {
            const Component = motion.div
            return (
                <Component id="bundled" layout>
                    <asyncMotion.div id="child" layout />
                </Component>
            )
        }

        const { container } = render(
            <asyncMotion.div id="parent" layout>
                <asyncMotion.div id="plain">
                    <Bundled />
                </asyncMotion.div>
                <asyncMotion.div id="sibling" />
            </asyncMotion.div>
        )
        const get = (id: string) => container.querySelector("#" + id)!
        await settle()

        const parent = projectionOf(get("parent"))
        const plain = projectionOf(get("plain"))
        const bundled = projectionOf(get("bundled"))

        expect(plain.parent === parent).toBe(true)
        expect(bundled.parent === plain).toBe(true)
        expect(projectionOf(get("child")).parent === bundled).toBe(true)
        expect(projectionOf(get("sibling")).parent === parent).toBe(true)
        expect(projectionOf(get("sibling")).instance === get("sibling")).toBe(true)
    })
})
