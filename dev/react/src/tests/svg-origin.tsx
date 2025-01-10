import { motion } from "framer-motion"
import { useEffect, useState } from "react"

export const App = () => {
    const [{ cx, width, y }, setDimensions] = useState({
        cx: 50,
        width: 100,
        y: 100,
    })
    const [scale, setScale] = useState(1)

    useEffect(() => {
        const timeout = setTimeout(() => {
            setScale(2)

            setTimeout(() => {
                setDimensions({ cx: 100, width: 200, y: 100 })

                setTimeout(() => {
                    setScale(0.5)
                }, 50)
            }, 50)
        }, 50)

        return () => clearTimeout(timeout)
    }, [])
    console.log("render", scale)
    return (
        <>
            <svg
                width="1000"
                height="1000"
                viewBox="0 0 1000 1000"
                xmlns="http://www.w3.org/2000/svg"
            >
                <motion.circle
                    cx={cx}
                    cy={100}
                    r={50}
                    initial={false}
                    animate={{ scale }}
                    transition={{ duration: 0.2 }}
                />
                <motion.rect
                    x={200}
                    y={y}
                    width={width}
                    height={100}
                    initial={false}
                    animate={{ scale }}
                    transition={{ duration: 0.2 }}
                />

                <motion.circle
                    cx={400}
                    cy={cx}
                    r={50}
                    initial={{ fill: "#000" }}
                    animate={
                        scale === 1 ? { fill: "#fff" } : { scale, fill: "#f00" }
                    }
                    id="new-transform"
                />
            </svg>
        </>
    )
}
