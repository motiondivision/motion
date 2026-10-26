import { motion, useScroll } from "framer-motion"
import { useRef } from "react"

/**
 * Reporter's sandbox from issue #2546. ?axis=x adds axis: "x".
 */
const axis = new URLSearchParams(window.location.search).get("axis") as
    | "x"
    | null

function Item({
    container,
    index,
}: {
    container: React.RefObject<HTMLElement>
    index: number
}) {
    const ref = useRef(null)
    const { scrollXProgress } = useScroll({
        target: ref,
        container,
        layoutEffect: true,
        offset: ["end end", "start start"],
        ...(axis ? { axis } : {}),
    })

    return (
        <section style={{ width: "70vw", flexShrink: 0 }}>
            <div ref={ref}>
                <svg width="75" height="75" viewBox="0 0 100 100">
                    <motion.circle
                        id={`indicator-${index}`}
                        cx="50"
                        cy="50"
                        r="30"
                        pathLength="1"
                        fill="none"
                        stroke="red"
                        strokeWidth="10"
                        style={{ pathLength: scrollXProgress }}
                    />
                </svg>
            </div>
        </section>
    )
}

export const App = () => {
    const ref = useRef(null)

    return (
        <>
            <header style={{ height: "10vh" }}>header</header>
            <main
                id="container"
                ref={ref}
                style={{
                    position: "fixed",
                    height: "90vh",
                    width: "100vw",
                    overflowX: "auto",
                    overflowY: "hidden",
                }}
            >
                <div style={{ display: "flex", flexFlow: "row nowrap" }}>
                    {Array.from({ length: 12 }, (_, i) => (
                        <Item key={i} index={i} container={ref} />
                    ))}
                </div>
            </main>
        </>
    )
}
