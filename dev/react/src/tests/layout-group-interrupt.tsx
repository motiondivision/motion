import { LayoutGroup, motion, MotionConfig, Transition } from "framer-motion"
import { useId, useState } from "react"

/**
 * #button is in its own LayoutGroup, so toggling #expander re-measures
 * #text-wrapper but not #button, which must follow its parent via its
 * relative target. Clicking #button also moves it right within
 * #text-wrapper, so its own animation has a relative component.
 */
const transition: Transition = {
    layout: { type: "tween", ease: "linear", duration: 10 },
}

export function App() {
    const [visible, setVisible] = useState(false)

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                alignItems: "center",
            }}
        >
            {visible && (
                <div style={{ background: "green", width: 100, height: 100 }} />
            )}
            <LayoutGroup>
                <MotionConfig transition={transition}>
                    <motion.div layout="position">
                        <Expander />
                    </motion.div>
                    <motion.div
                        id="text-wrapper"
                        layout="position"
                        style={{ display: "flex", gap: 4 }}
                    >
                        {visible ? "some longer text" : "some text"}
                        <LayoutGroup inherit="id">
                            <Button onClick={() => setVisible(!visible)} />
                        </LayoutGroup>
                    </motion.div>
                </MotionConfig>
            </LayoutGroup>
        </div>
    )
}

function Expander() {
    const [expanded, setExpanded] = useState(false)

    return (
        <motion.div
            id="expander"
            layoutId={useId()}
            onClick={() => setExpanded(!expanded)}
            style={{
                width: 100,
                height: expanded ? 100 : 25,
                background: "red",
            }}
        />
    )
}

function Button({ onClick }: { onClick: VoidFunction }) {
    return (
        <motion.div
            id="button"
            layoutId={useId()}
            onClick={onClick}
            style={{ background: "blue", padding: 10 }}
        >
            Add child
        </motion.div>
    )
}
