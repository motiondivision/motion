import { domMax, LazyMotion, m, motion, Reorder } from "framer-motion"
import { useState } from "react"

/**
 * Issue #2094: Inactionable warning when using LazyMotion + Reorder.
 *
 * The whole app is wrapped in <LazyMotion strict features={domMax}> and one
 * page renders Reorder.Group + Reorder.Item. Reorder internally renders
 * `motion` components, so strict mode logs "You have rendered a `motion`
 * component within a `LazyMotion` component" for the Group and every Item,
 * and the user has no way to fix or silence it.
 *
 * ?features=async loads domMax lazily, as in the reporter's repro.
 * ?control=true renders a plain `motion.div` with `ignoreStrict` instead, to
 * verify the warning is observable.
 */
export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const features =
        params.get("features") === "async"
            ? () => import("framer-motion").then((mod) => mod.domMax)
            : domMax
    const [items, setItems] = useState([0, 1, 2])

    if (params.get("control") === "true") {
        return (
            <LazyMotion strict features={features}>
                <motion.div id="control" ignoreStrict>
                    control
                </motion.div>
            </LazyMotion>
        )
    }

    return (
        <LazyMotion strict features={features}>
            <m.div id="m-sibling" animate={{ opacity: 1 }} />
            <Reorder.Group
                id="group"
                axis="y"
                values={items}
                onReorder={setItems}
                style={{ listStyle: "none", padding: 0 }}
            >
                {items.map((item) => (
                    <Reorder.Item
                        key={item}
                        value={item}
                        id={`item-${item}`}
                        style={{
                            height: 50,
                            margin: 5,
                            background: "red",
                        }}
                    >
                        {item}
                    </Reorder.Item>
                ))}
            </Reorder.Group>
        </LazyMotion>
    )
}
