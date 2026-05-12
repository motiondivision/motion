import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"

const items = [
    { id: "a", title: "Item A" },
    { id: "b", title: "Item B" },
    { id: "c", title: "Item C" },
]

function AccordionItem({ id, title }: { id: string; title: string }) {
    const [open, setOpen] = useState(false)

    return (
        <div>
            <button
                className="trigger"
                data-id={id}
                onClick={() => setOpen((o) => !o)}
            >
                {title}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.section
                        key="content"
                        data-panel={id}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                            type: "tween",
                            ease: "linear",
                            duration: 0.5,
                        }}
                        style={{ overflow: "hidden" }}
                    >
                        <div
                            data-content={id}
                            style={{ padding: 20, height: 100 }}
                        >
                            Content for {title}
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>
        </div>
    )
}

export const App = () => {
    return (
        <div id="accordion" style={{ width: 400 }}>
            {items.map((item) => (
                <AccordionItem key={item.id} id={item.id} title={item.title} />
            ))}
        </div>
    )
}
