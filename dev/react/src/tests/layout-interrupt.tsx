import { cancelFrame, frame, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"

export const App = () => {
    const [state, setState] = useState(false)
    const [message, setMessage] = useState("")
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const checkOffset = () => {
            if (!ref.current) return

            const { left } = ref.current.getBoundingClientRect()
            console.log(left)
        }

        frame.postRender(checkOffset)
        return cancelFrame(checkOffset)
    }, [ref.current])

    return (
        <>
            <pre>{message}</pre>
            <motion.div
                layout
                style={{
                    position: "absolute",
                    top: state ? 100 : 0,
                    left: state ? 100 : 0,
                    width: 100,
                    height: state ? 50 : 100,
                    background: "blue",
                }}
            />
            <motion.div
                id="box"
                ref={ref}
                data-testid="box"
                layout
                style={{ ...box, left: state ? 100 : 0, top: state ? 100 : 0 }}
                onClick={() => setState(!state)}
                transition={{ duration: 2 }}
            />
        </>
    )
}

const box = {
    position: "relative",
    top: 0,
    left: 0,
    background: "red",
    width: 100,
    height: 100,
}
