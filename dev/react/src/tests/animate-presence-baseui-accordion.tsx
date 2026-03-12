import { Accordion } from "@base-ui-components/react/accordion"
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
    value,
    setValue,
}: {
    item: (typeof items)[0]
    isOpen: boolean
    value: string
    setValue: (value: string[]) => void
}) {
    const handleClick = () => {
        setValue(isOpen ? [] : [value])
    }

    return (
        <Accordion.Item value={value}>
            <Accordion.Header>
                <Accordion.Trigger
                    render={
                        <motion.button
                            className="trigger"
                            data-id={item.id}
                            onClick={handleClick}
                        />
                    }
                >
                    {item.title}
                </Accordion.Trigger>
            </Accordion.Header>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <Accordion.Panel
                        className="panel"
                        data-panel={item.id}
                        keepMounted
                    >
                        <motion.div
                            variants={{
                                open: {
                                    height: "auto",
                                    opacity: 1,
                                },
                                closed: {
                                    height: 0,
                                    opacity: 0,
                                },
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
                    </Accordion.Panel>
                )}
            </AnimatePresence>
        </Accordion.Item>
    )
}

export const App = () => {
    const [value, setValue] = useState<string[]>(["a"])

    return (
        <MotionConfig
            transition={{ type: "tween", ease: "linear", duration: 10 }}
        >
            <Accordion.Root
                value={value}
                onValueChange={(newValue: string[]) => setValue(newValue)}
                multiple={false}
            >
                {items.map((item) => (
                    <AccordionItem
                        key={item.id}
                        item={item}
                        isOpen={value.includes(item.id)}
                        value={item.id}
                        setValue={setValue}
                    />
                ))}
            </Accordion.Root>
        </MotionConfig>
    )
}
