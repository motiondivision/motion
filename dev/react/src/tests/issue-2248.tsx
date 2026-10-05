import { motion, PanInfo } from "framer-motion"
import { useState } from "react"

/**
 * Repro for #2248: changing layout from onDrag (mid-drag) should still
 * animate the element back to its original slot, as it does from onDragEnd.
 */
function Card({ id }: { id: number }) {
    const [isSelected, setIsSelected] = useState(false)

    function handleDrag(_: unknown, info: PanInfo) {
        if (info.offset.y > 100) setIsSelected(false)
    }

    return (
        <div id={`slot-${id}`} style={{ height: 192 }}>
            {isSelected && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.5)",
                    }}
                />
            )}
            <motion.div
                id={`card-${id}`}
                data-selected={isSelected}
                style={
                    isSelected
                        ? {
                              position: "fixed",
                              inset: 0,
                              width: "50%",
                              height: "auto",
                              margin: "48px auto",
                              background: "orange",
                          }
                        : { width: "100%", height: "100%", background: "red" }
                }
                onClick={() => setIsSelected(true)}
                layout
                transition={{ type: "spring" }}
                drag={isSelected && "y"}
                dragSnapToOrigin
                onDragEnd={id === 0 ? handleDrag : undefined}
                onDrag={id === 1 ? handleDrag : undefined}
            >
                <p>{id === 0 ? "onDragEnd" : "onDrag"}</p>
            </motion.div>
        </div>
    )
}

export const App = () => (
    <div style={{ width: 600 }}>
        <Card id={0} />
        <Card id={1} />
    </div>
)
