import type { Handle } from "remix/component"
import { LayoutGroup, motion } from "motion/remix"

const linear = { duration: 1, ease: "linear" } as const
const w = window as any

function List(handle: Handle) {
    let items = ["a", "b", "c"]
    w.reverseList = () => {
        items = [...items].reverse()
        handle.update()
    }
    return () => (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((id) => (
                <motion.li
                    key={id}
                    id={"item-" + id}
                    layout
                    transition={linear}
                    style={{
                        height: "40px",
                        background: "#ddd",
                        margin: "4px",
                    }}
                >
                    {id}
                </motion.li>
            ))}
        </ul>
    )
}

/**
 * Each tab is its own component, so the underline moves between
 * components.
 */
function Tab(handle: Handle<{ index: number; group: string }>) {
    let selected = handle.props.index === 0
    const tabs = (w.tabs ||= {})
    ;(tabs[handle.props.group] ||= []).push((index: number) => {
        selected = index === handle.props.index
        handle.update()
    })
    return () => (
        <div style={{ width: "50px", position: "relative" }}>
            tab
            {selected && (
                <motion.div
                    key="underline"
                    class={"underline-" + handle.props.group}
                    layoutId="underline"
                    transition={linear}
                    style={{ height: "4px", background: "red" }}
                />
            )}
        </div>
    )
}

w.selectTab = (group: string, index: number) =>
    w.tabs[group].forEach((select: (i: number) => void) => select(index))

function Tabs(handle: Handle<{ group: string }>) {
    return () => (
        <LayoutGroup id={handle.props.group}>
            <div style={{ display: "flex", gap: "100px", height: "30px" }}>
                {[0, 1, 2].map((index) => (
                    <Tab key={index} index={index} group={handle.props.group} />
                ))}
            </div>
        </LayoutGroup>
    )
}

export function App() {
    return () => (
        <main>
            <List />
            <Tabs group="one" />
            <Tabs group="two" />
        </main>
    )
}
