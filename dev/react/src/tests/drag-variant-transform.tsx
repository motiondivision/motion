import { motion, useDragControls, Variants } from "framer-motion"

const variants: Variants = {
    none: (custom?: string) => ({
        width: "fit-content",
        height: "fit-content",
        transform: custom || undefined,
    }),
}

// Regression test for #2807: a variant that sets a literal `transform` string
// should not prevent drag from moving the element.
export const App = () => {
    const dragControls = useDragControls()

    return (
        <div style={{ height: 800, padding: 100 }}>
            <button
                data-testid="handle"
                onPointerDown={(e) => dragControls.start(e)}
                style={{
                    display: "block",
                    width: 100,
                    height: 20,
                    background: "blue",
                    marginBottom: 10,
                }}
            />
            <motion.div
                data-testid="draggable"
                custom="translate(50px, 60px)"
                initial="none"
                animate="none"
                variants={variants}
                drag
                dragListener={false}
                dragControls={dragControls}
                dragMomentum={false}
                style={{
                    background: "red",
                    padding: 30,
                }}
            >
                window
            </motion.div>
        </div>
    )
}
