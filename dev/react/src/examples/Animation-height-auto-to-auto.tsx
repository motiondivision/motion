import { motion } from "framer-motion"
import { useState } from "react"

/**
 * animate={{ height: "auto" }} animates between auto sizes: whenever a
 * render changes the content, the height animates from its previous size.
 */

const transition = {
    type: "spring",
    visualDuration: 0.35,
    bounce: 0.15,
} as const

const tabs = {
    Short: ["One line of content."],
    Medium: [
        "A few lines of content.",
        "Siblings below move with the box, as its real height animates.",
        "Text isn't stretched, because nothing is scaled.",
    ],
    Long: Array.from(
        { length: 8 },
        (_, i) => `Line ${i + 1}: switch tabs mid-animation to retarget.`
    ),
}

function Tabs() {
    const [tab, setTab] = useState<keyof typeof tabs>("Short")

    return (
        <section style={card}>
            <h3>Tabs</h3>
            <div style={{ display: "flex", gap: 8 }}>
                {Object.keys(tabs).map((name) => (
                    <button
                        key={name}
                        onClick={() => setTab(name as keyof typeof tabs)}
                        style={{ fontWeight: tab === name ? "bold" : "normal" }}
                    >
                        {name}
                    </button>
                ))}
            </div>
            <motion.div
                animate={{ height: "auto" }}
                transition={transition}
                style={panel}
            >
                {tabs[tab].map((line) => (
                    <p key={line}>{line}</p>
                ))}
            </motion.div>
            <p>Content below the panel.</p>
        </section>
    )
}

function Accordion() {
    const [open, setOpen] = useState(false)
    const [items, setItems] = useState(2)

    return (
        <section style={card}>
            <h3>Accordion: height 0 / "auto", plus content changes</h3>
            <button onClick={() => setOpen(!open)}>
                {open ? "Close" : "Open"}
            </button>
            <motion.div
                initial={false}
                animate={{ height: open ? "auto" : 0 }}
                transition={transition}
                style={{ ...panel, height: 0 }}
            >
                {Array.from({ length: items }, (_, i) => (
                    <p key={i}>Item {i + 1}</p>
                ))}
                <button onClick={() => setItems(items + 1)}>Add item</button>{" "}
                <button onClick={() => setItems(Math.max(1, items - 1))}>
                    Remove item
                </button>
            </motion.div>
        </section>
    )
}

function Label() {
    const [copied, setCopied] = useState(false)

    return (
        <section style={card}>
            <h3>width: "auto"</h3>
            <motion.button
                animate={{ width: "auto" }}
                transition={transition}
                onClick={() => setCopied(!copied)}
                style={{ overflow: "hidden", whiteSpace: "nowrap" }}
            >
                {copied ? "Copied to clipboard!" : "Copy"}
            </motion.button>
        </section>
    )
}

function Comparison() {
    const [long, setLong] = useState(false)
    const text = long ? tabs.Long.slice(0, 5) : tabs.Short

    return (
        <section style={card}>
            <h3>layout (scale) vs height: "auto"</h3>
            <button onClick={() => setLong(!long)}>Toggle content</button>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <motion.div
                    layout
                    transition={transition}
                    style={{ ...panel, flex: 1 }}
                >
                    <strong>layout</strong>
                    {text.map((line) => (
                        <p key={line}>{line}</p>
                    ))}
                </motion.div>
                <motion.div
                    animate={{ height: "auto" }}
                    transition={transition}
                    style={{ ...panel, flex: 1 }}
                >
                    <strong>height: "auto"</strong>
                    {text.map((line) => (
                        <p key={line}>{line}</p>
                    ))}
                </motion.div>
            </div>
        </section>
    )
}

export const App = () => (
    <div
        style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}
    >
        <Tabs />
        <Accordion />
        <Label />
        <Comparison />
    </div>
)

const card = {
    padding: 16,
    marginBottom: 24,
    border: "1px solid #ddd",
    borderRadius: 8,
}

const panel = {
    overflow: "hidden",
    background: "#f3f0ff",
    borderRadius: 8,
    padding: "0 12px",
    marginTop: 12,
}
