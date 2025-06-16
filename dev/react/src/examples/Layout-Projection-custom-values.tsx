import { addScaleCorrector, motion } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * This demo is called "Framer border" because it demonstrates border animations as Framer
 * implements borders, by positioning the inner div separately to the sized outer Frame using `inset`
 * and defining additional values with handlers passed to `autoValues`.
 */

interface ScaleCorrectorContext {
    targetDelta: { x: { scale: number }; y: { scale: number } }
    treeScale: { x: number; y: number }
}

type ScaleCorrector = (
    latest: string | number,
    context: ScaleCorrectorContext
) => string

const borderWidth = (axis: "x" | "y"): { correct: ScaleCorrector } => ({
    correct: (
        latest: string | number,
        { targetDelta, treeScale }: ScaleCorrectorContext
    ) => {
        const value = typeof latest === "string" ? parseFloat(latest) : latest
        return value / targetDelta[axis].scale / treeScale[axis] + "px"
    },
})

const xBorder = () => borderWidth("x")
const yBorder = () => borderWidth("y")

const border = {
    borderTopWidth: yBorder(),
    borderLeftWidth: xBorder(),
    borderRightWidth: xBorder(),
    borderBottomWidth: yBorder(),
}

export const App = () => {
    const [isOn, setOn] = useState(false)

    useEffect(() => {
        addScaleCorrector(border)
    }, [])

    return (
        <motion.div
            layout
            transition={{ duration: 3, ease: "circIn" }}
            onClick={() => setOn(!isOn)}
            style={{
                display: "block",
                position: "relative",
                background: "white",
                width: isOn ? 700 : 100,
                height: isOn ? 400 : 100,
            }}
        >
            <motion.div
                layout
                initial={false}
                animate={
                    isOn
                        ? {
                              borderColor: "#000",
                              borderTopWidth: 5,
                              borderRightWidth: 5,
                              borderLeftWidth: 5,
                              borderBottomWidth: 30,
                          }
                        : {
                              borderColor: "#90f",
                              borderTopWidth: 50,
                              borderRightWidth: 50,
                              borderLeftWidth: 50,
                              borderBottomWidth: 50,
                          }
                }
                transition={{ duration: 3, ease: "circIn" }}
                style={{
                    position: "absolute",
                    inset: "0px",
                    borderStyle: "solid",
                }}
            />
        </motion.div>
    )
}
