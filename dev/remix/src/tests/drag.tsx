import { motion } from "motion/remix"

const w = window as any

export function App() {
    return () => (
        <main style={{ padding: "100px" }}>
            <motion.div id="drag" class="box" drag dragMomentum={false} />
            <motion.div
                id="drag-x"
                class="box"
                drag="x"
                dragMomentum={false}
                whileDrag={{ scale: 0.8 }}
                onDragEnd={() => (w.dragEnded = true)}
            />
        </main>
    )
}
