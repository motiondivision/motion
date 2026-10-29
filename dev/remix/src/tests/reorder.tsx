import { on, type Handle } from "remix/component"
import { Reorder } from "motion/remix"

const w = window as any
w.reorders = []
w.clicks = 0

const itemStyle = {
    width: "100px",
    height: "50px",
    background: "#ddd",
    flexShrink: 0,
}

interface ListProps {
    id: string
    initial: string[]
    axis?: "x" | "y" | "xy"
    style?: any
}

function List(handle: Handle<ListProps>) {
    let items = handle.props.initial
    return () => (
        <Reorder.Group
            id={handle.props.id}
            axis={handle.props.axis}
            values={items}
            onReorder={(next: string[], moved: string) => {
                w.reorders.push([handle.props.id, next.join(""), moved])
                items = next
                handle.update()
            }}
            style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 40px",
                ...handle.props.style,
            }}
        >
            {items.map((item) => (
                <Reorder.Item
                    key={item}
                    value={item}
                    id={handle.props.id + "-" + item}
                    class="item"
                    transition={{ duration: 0 }}
                    whileDrag={{ opacity: 0.5 }}
                    style={itemStyle}
                    mix={on("click", () => w.clicks++)}
                >
                    {item}
                </Reorder.Item>
            ))}
        </Reorder.Group>
    )
}

export function App() {
    return () => (
        <main style={{ padding: "20px" }}>
            <List id="y" initial={["a", "b", "c", "d"]} />
            <List
                id="x"
                initial={["a", "b", "c", "d"]}
                style={{ display: "flex", gap: "10px" }}
            />
            <List
                id="grid"
                initial={["a", "b", "c", "d"]}
                style={{
                    display: "grid",
                    gridTemplateColumns: "100px 100px",
                    gap: "10px",
                }}
            />
            <List
                id="rtl"
                axis="x"
                initial={["a", "b", "c"]}
                style={{ display: "flex", gap: "10px", direction: "rtl" }}
            />
        </main>
    )
}
