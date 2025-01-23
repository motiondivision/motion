import { animate, AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import styled from "styled-components"

const Container = styled.section`
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 100px;

    div {
        width: 100px;
        height: 100px;
        background-color: red;
    }
`

export const App = () => {
    const [state, setState] = useState(true)
    const params = new URLSearchParams(window.location.search)
    const position = params.get("position") || ("static" as any)
    const anchorX = params.get("anchor-x") || ("left" as any)
    const anchorY = params.get("anchor-y") || ("top" as any)
    const itemStyle =
        position === "relative" ? { position, top: 100, left: 100 } : {}

    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ref.current) return

        animate(ref.current, { opacity: [0, 1] }, { duration: 1 })
        animate(ref.current, { opacity: [1, 0.5] }, { duration: 1 })
    }, [])

    return (
        <Container onClick={() => setState(!state)}>
            <AnimatePresence
                anchorX={anchorX}
                anchorY={anchorY}
                mode="popLayout"
            >
                <motion.div
                    key="a"
                    id="a"
                    layout
                    transition={{ ease: () => 1 }}
                    style={{ ...itemStyle }}
                />
                {state ? (
                    <motion.div
                        key="b"
                        id="b"
                        animate={{
                            opacity: 1,
                            transition: { duration: 0.001 },
                        }}
                        exit={{ opacity: 0, transition: { duration: 10 } }}
                        layout
                        style={{ ...itemStyle, backgroundColor: "green" }}
                    />
                ) : null}
                <motion.div
                    key="c"
                    id="c"
                    layout
                    transition={{ ease: () => 1 }}
                    style={{ ...itemStyle, backgroundColor: "blue" }}
                />
            </AnimatePresence>
            <div
                ref={ref}
                style={{ ...itemStyle, backgroundColor: "purple" }}
            />
        </Container>
    )
}
