import { motion, useTransform, useViewportScroll } from "framer-motion"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

export function App() {
    const [elementTop, setElementTop] = useState(0)
    const ref = useRef<HTMLDivElement>(null)
    const { scrollY } = useViewportScroll()

    useLayoutEffect(() => {
        if (!ref.current) return
        setElementTop(ref.current.offsetTop)
    }, [ref])

    const opacity = useTransform(
        scrollY,
        [elementTop, elementTop + 600],
        [1, 0]
    )

    useEffect(() => {
        const log = () => {
            console.log(elementTop, scrollY.get(), opacity.get())
        }
        window.addEventListener("scroll", log)
        return () => window.removeEventListener("scroll", log)
    }, [elementTop, scrollY, opacity])

    return (
        <>
            <div
                style={{
                    height: "400vh",
                    backgroundColor: "lightblue",
                }}
            />
            <div
                ref={ref}
                style={{
                    height: "200vh",
                    width: "100vw",
                }}
            >
                <motion.div
                    initial={{ background: "#f9cb29" }}
                    style={{
                        opacity,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            width: "100%",
                            height: "100vh",
                            position: "relative",
                        }}
                    >
                        Hi!
                    </div>
                </motion.div>
            </div>
        </>
    )
}
