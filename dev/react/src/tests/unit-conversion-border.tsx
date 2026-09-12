import { animate } from "framer-motion"
import { useEffect, useRef } from "react"

/**
 * Converting width from px to % on a content-box element with borders.
 * The measured origin must be the used width (100px), not the bounding
 * box width (120px including borders), or the animation starts with a jump.
 */
export const App = () => {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        animate(
            ref.current!,
            { width: "50%" },
            {
                duration: 10,
                ease: "linear",
                onUpdate: (width) => {
                    if (typeof width === "number" && width > 110) {
                        ref.current!.textContent = "Fail"
                    }
                },
            }
        )
    }, [])

    return (
        <div style={{ width: 400 }}>
            <div
                ref={ref}
                id="box"
                style={{
                    width: 100,
                    height: 100,
                    boxSizing: "content-box",
                    border: "10px solid #000",
                    background: "#ffaa00",
                }}
            >
                Success
            </div>
        </div>
    )
}
