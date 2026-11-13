import { motion, useDragControls } from "framer-motion"

/**
 * #4053: a mouse press that starts a drag has its default prevented, to stop
 * a native text selection. Text inputs, selects and contenteditable must
 * still take focus (and a caret) from a press, whether the drag is started
 * by dragControls from an ancestor or the draggable is the input itself.
 */
export const App = () => {
    const controls = useDragControls()

    return (
        <div style={{ padding: 20 }}>
            <motion.div
                id="draggable"
                drag
                dragListener={false}
                dragControls={controls}
                dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
                onPointerDown={(event) => controls.start(event)}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    width: 300,
                    padding: 10,
                    background: "#eee",
                }}
            >
                <span id="text">Drag from here</span>
                <input id="input" defaultValue="input" />
                <textarea id="textarea" defaultValue="textarea" />
                <select id="select" defaultValue="b">
                    <option value="a">a</option>
                    <option value="b">b</option>
                </select>
                <div
                    id="editable"
                    contentEditable
                    suppressContentEditableWarning
                >
                    <span id="editable-child">editable</span>
                </div>
            </motion.div>
            <motion.input
                id="drag-input"
                drag
                dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
                defaultValue="draggable input"
                style={{ marginTop: 20 }}
            />
        </div>
    )
}
