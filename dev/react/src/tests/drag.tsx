import { motion } from "framer-motion"
import { useLayoutEffect } from "react"

function getValueParam(params: any, name: string, isPercentage: boolean) {
    const param = params.get(name) as string | undefined
    if (!param) return 0
    if (isPercentage) {
        return param + "%"
    } else {
        return parseFloat(param)
    }
}

// It's important for this test to only trigger a single rerender while dragging (in response to onDragStart) of draggable component.
export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const axis = params.get("axis")
    const lock = params.get("lock")
    const isPercentage = Boolean(params.get("percentage"))
    const top = parseFloat(params.get("top")) || undefined
    const left = parseFloat(params.get("left")) || undefined
    const right = parseFloat(params.get("right")) || undefined
    const bottom = parseFloat(params.get("bottom")) || undefined
    const showChild = Boolean(params.get("showChild"))
    const snapToOrigin = Boolean(params.get("return"))
    const x = getValueParam(params, "x", isPercentage)
    const y = getValueParam(params, "y", isPercentage)
    const layout = params.get("layout") || undefined

    // We do this to test when scroll position isn't 0/0
    useLayoutEffect(() => {
        window.scrollTo(0, 100)
    }, [])

    return (
        <div style={{ height: 2000, paddingTop: 100 }}>
            <motion.div
                id="box"
                data-testid="draggable"
                drag={axis ? axis : true}
                dragElastic={0}
                dragMomentum={false}
                dragConstraints={{ top, left, right, bottom }}
                dragSnapToOrigin={snapToOrigin}
                dragDirectionLock={!!lock}
                layout={layout}
                initial={{
                    width: 50,
                    height: 50,
                    background: "red",
                    x,
                    y,
                }}
            >
                {showChild ? (
                    <div
                        data-testid="draggable-child"
                        style={{ width: 50, height: 50, background: "blue" }}
                    />
                ) : null}
            </motion.div>
        </div>
    )
}
