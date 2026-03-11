import { motion } from "framer-motion"

/**
 * Test page for issue #1674: Interactive elements inside draggable elements
 * should not trigger drag when clicked/interacted with.
 */
export const App = () => {
    return (
        <div style={{ padding: 100 }}>
            <motion.div
                id="draggable"
                data-testid="draggable"
                drag
                dragElastic={0}
                dragMomentum={false}
                style={{
                    width: 400,
                    height: 200,
                    background: "red",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    padding: 10,
                }}
            >
                <input
                    type="text"
                    data-testid="input"
                    defaultValue="Select me"
                    style={{
                        width: 80,
                        height: 30,
                        padding: 5,
                    }}
                />
                <textarea
                    data-testid="textarea"
                    defaultValue="Text"
                    style={{
                        width: 60,
                        height: 30,
                        padding: 5,
                    }}
                />
                <button
                    data-testid="button"
                    style={{
                        width: 60,
                        height: 30,
                        padding: 5,
                    }}
                >
                    Click
                </button>
                <a
                    href="#test"
                    data-testid="link"
                    style={{
                        display: "inline-block",
                        width: 60,
                        height: 30,
                        padding: 5,
                        background: "white",
                    }}
                >
                    Link
                </a>
                <select
                    data-testid="select"
                    style={{
                        width: 80,
                        height: 30,
                    }}
                >
                    <option value="1">Option 1</option>
                    <option value="2">Option 2</option>
                    <option value="3">Option 3</option>
                </select>
                <label
                    data-testid="label"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        background: "white",
                        padding: 5,
                    }}
                >
                    <input
                        type="checkbox"
                        data-testid="checkbox"
                    />
                    Check
                </label>
                <div
                    contentEditable
                    data-testid="contenteditable"
                    style={{
                        width: 80,
                        height: 30,
                        padding: 5,
                        background: "white",
                    }}
                >
                    Edit me
                </div>
            </motion.div>
        </div>
    )
}
