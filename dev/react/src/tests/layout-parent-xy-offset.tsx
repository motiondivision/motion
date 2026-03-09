import { motion } from "framer-motion"
import { useId, useState } from "react"

function Tabs() {
    const items = ["a", "b", "c", "d", "e"]
    const [selectedIndex, setSelectedIndex] = useState(0)
    const uuid = useId()

    return (
        <div
            style={{
                display: "flex",
                gap: 10,
                height: 64,
                width: 500,
                marginBottom: 12,
            }}
        >
            {items.map((item, index) => (
                <div
                    key={item}
                    onClick={() => setSelectedIndex(index)}
                    style={{
                        flex: 1,
                        borderRadius: 8,
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#eee",
                    }}
                >
                    <div
                        style={{
                            position: "relative",
                            zIndex: 1,
                            color: "white",
                        }}
                    >
                        {item}
                    </div>
                    {selectedIndex === index ? (
                        <motion.div
                            layoutId={"selected-" + uuid}
                            className="indicator"
                            style={{
                                position: "absolute",
                                top: 4,
                                left: 4,
                                right: 4,
                                bottom: 4,
                                background: "#444ccc",
                                borderRadius: 8,
                            }}
                        />
                    ) : null}
                </div>
            ))}
        </div>
    )
}

export const App = () => {
    return (
        <div style={{ padding: 12 }}>
            <motion.div id="motion-parent" style={{ x: 50, y: 50 }}>
                <div style={{ marginBottom: 12 }}>Motion (x: 50, y: 50)</div>
                <Tabs />
            </motion.div>
            <div style={{ transform: "translate3d(50px, 50px, 0)" }}>
                <div style={{ marginBottom: 12 }}>Transform</div>
                <Tabs />
            </div>
            <div id="result" />
        </div>
    )
}
