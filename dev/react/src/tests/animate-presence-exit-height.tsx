import { AnimatePresence, motion, MotionConfig } from "framer-motion"
import { useState } from "react"

const items = [
    { id: "a", title: "Item A", content: "Content for item A" },
    { id: "b", title: "Item B", content: "Content for item B" },
    { id: "c", title: "Item C", content: "Content for item C" },
]

function AccordionItem({
    item,
    isOpen,
    onToggle,
}: {
    item: (typeof items)[0]
    isOpen: boolean
    onToggle: () => void
}) {
    return (
        <div>
            <button className="trigger" data-id={item.id} onClick={onToggle}>
                {item.title}
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        className="panel"
                        data-panel={item.id}
                        variants={{
                            open: { height: "auto", opacity: 1 },
                            closed: { height: 0, opacity: 0 },
                        }}
                        initial="closed"
                        animate="open"
                        exit="closed"
                        style={{ overflow: "hidden" }}
                        transition={{
                            type: "tween",
                            ease: "linear",
                            duration: 10,
                        }}
                    >
                        <div style={{ padding: 20 }}>{item.content}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export const App = () => {
    const [openId, setOpenId] = useState<string | null>("a")

    return (
        <MotionConfig
            transition={{ type: "tween", ease: "linear", duration: 10 }}
        >
            <div id="accordion" style={{ width: 400 }}>
                {items.map((item) => (
                    <AccordionItem
                        key={item.id}
                        item={item}
                        isOpen={openId === item.id}
                        onToggle={() =>
                            setOpenId(openId === item.id ? null : item.id)
                        }
                    />
                ))}
            </div>
        </MotionConfig>
    )
}
