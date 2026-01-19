import { motion, useMotionValue } from "framer-motion"
import { useState } from "react"

/**
 * Test for issue #1436: layoutDependency not working with layoutId
 *
 * This test verifies that when a component with layoutId unmounts and remounts
 * in a different location (e.g., switching sections), it should NOT animate
 * if layoutDependency hasn't changed.
 *
 * Expected behavior:
 * - When clicking "Switch Section": NO animation (same layoutDependency)
 * - When clicking "Jump here": animation should occur (layoutDependency changes)
 */

function Items() {
    const [selected, setSelected] = useState(0)
    const backgroundColor = useMotionValue("#f00")

    return (
        <>
            <article style={{ marginBottom: 20 }}>
                <button id="jump-0" onClick={() => setSelected(0)}>
                    Jump here
                </button>
                {selected === 0 && (
                    <motion.div
                        id="box"
                        layoutId="box"
                        layoutDependency={selected}
                        style={{
                            width: 100,
                            height: 100,
                            backgroundColor,
                            borderRadius: 10,
                        }}
                        transition={{ duration: 0.5, ease: () => 0.5 }}
                        onLayoutAnimationStart={() => backgroundColor.set("#0f0")}
                        onLayoutAnimationComplete={() => backgroundColor.set("#00f")}
                    />
                )}
            </article>
            <article>
                <button id="jump-1" onClick={() => setSelected(1)}>
                    Jump here
                </button>
                {selected === 1 && (
                    <motion.div
                        id="box"
                        layoutId="box"
                        layoutDependency={selected}
                        style={{
                            width: 100,
                            height: 100,
                            backgroundColor,
                            borderRadius: 10,
                        }}
                        transition={{ duration: 0.5, ease: () => 0.5 }}
                        onLayoutAnimationStart={() => backgroundColor.set("#0f0")}
                        onLayoutAnimationComplete={() => backgroundColor.set("#00f")}
                    />
                )}
            </article>
        </>
    )
}

function SectionA() {
    return (
        <div id="section-a">
            <p>Section A Header</p>
            <Items />
        </div>
    )
}

function SectionB() {
    return (
        <div id="section-b">
            <Items />
        </div>
    )
}

export const App = () => {
    const [section, setSection] = useState<"a" | "b">("a")

    return (
        <div style={{ position: "relative" }}>
            <div style={{ marginBottom: 20 }}>
                <button
                    id="section-a-btn"
                    onClick={() => setSection("a")}
                >
                    Section A
                </button>
                <button
                    id="section-b-btn"
                    onClick={() => setSection("b")}
                    style={{ marginLeft: 10 }}
                >
                    Section B
                </button>
            </div>

            {section === "a" && <SectionA />}
            {section === "b" && <SectionB />}
        </div>
    )
}
