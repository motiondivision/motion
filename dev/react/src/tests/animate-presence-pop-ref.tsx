import { AnimatePresence, motion } from "framer-motion"
import { forwardRef, useImperativeHandle, useRef, useState } from "react"

const containerStyles = {
    position: "relative" as const,
    display: "flex",
    flexDirection: "column" as const,
    padding: "100px",
}

const boxStyles = {
    width: "100px",
    height: "100px",
    backgroundColor: "red",
}

interface BoxHandle {
    flash: () => void
}

/**
 * Test component that uses forwardRef and useImperativeHandle
 * This triggers the React 19 ref warning in PopChild
 */
const Box = forwardRef<BoxHandle, { id: string; style?: React.CSSProperties }>(
    function Box({ id, style }, ref) {
        const elementRef = useRef<HTMLDivElement>(null)

        useImperativeHandle(ref, () => ({
            flash: () => {
                if (elementRef.current) {
                    elementRef.current.style.opacity = "0.5"
                    setTimeout(() => {
                        if (elementRef.current) {
                            elementRef.current.style.opacity = "1"
                        }
                    }, 100)
                }
            },
        }))

        return (
            <motion.div
                ref={elementRef}
                id={id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.001 } }}
                exit={{ opacity: 0, transition: { duration: 10 } }}
                style={{ ...boxStyles, ...style }}
            />
        )
    }
)

/**
 * Another test: Component with direct ref forwarding to motion element
 */
const BoxWithDirectRef = forwardRef<HTMLDivElement, { id: string; style?: React.CSSProperties }>(
    function BoxWithDirectRef({ id, style }, ref) {
        return (
            <motion.div
                ref={ref}
                id={id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.001 } }}
                exit={{ opacity: 0, transition: { duration: 10 } }}
                style={{ ...boxStyles, ...style }}
            />
        )
    }
)

export const App = () => {
    const [state, setState] = useState(true)
    const params = new URLSearchParams(window.location.search)
    const testType = params.get("type") || "imperative"

    const boxRef = useRef<BoxHandle>(null)
    const directRef = useRef<HTMLDivElement>(null)

    return (
        <div style={containerStyles} onClick={() => setState(!state)}>
            <AnimatePresence mode="popLayout">
                <motion.div
                    key="static"
                    id="static"
                    layout
                    style={{ ...boxStyles, backgroundColor: "gray" }}
                />
                {state ? (
                    testType === "imperative" ? (
                        <Box
                            key="box"
                            id="box"
                            ref={boxRef}
                            style={{ backgroundColor: "green" }}
                        />
                    ) : (
                        <BoxWithDirectRef
                            key="box"
                            id="box"
                            ref={directRef}
                            style={{ backgroundColor: "blue" }}
                        />
                    )
                ) : null}
            </AnimatePresence>
            <div id="result" data-state={state ? "shown" : "hidden"} />
        </div>
    )
}
