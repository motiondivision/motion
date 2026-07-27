import {
    correctParentTransform,
    MotionConfig,
    Reorder,
    useMotionValue,
} from "framer-motion"
import { ReactNode, useRef, useState } from "react"

/**
 * Reproduction + supported-workaround fixture for the scaled-parent Reorder
 * cluster (#2449 / #2750).
 *
 * A Reorder list sits inside a parent with a raw CSS `transform: scale()` and
 * a non-centre `transform-origin`. Raw CSS transforms on ancestors are
 * invisible to the projection / drag measurement system (it only tracks motion
 * values), so by default the dragged item translates faster/slower than the
 * cursor and reorder thresholds fire at the wrong positions — the list appears
 * to "move around" relative to the pointer.
 *
 * The supported fix is `correctParentTransform(ref)` fed to
 * `MotionConfig transformPagePoint`: it routes BOTH pan-session pointer points
 * and projection viewport measurements through the inverse of the parent's
 * computed matrix, putting gesture offsets and measured boxes back in the same
 * (local) space.
 *
 * - `?scale=`     parent scale factor (default `0.5`)
 * - `?corrected=` when `"true"`, applies `correctParentTransform`
 */
const initialItems = [0, 1, 2, 3]

const Item = ({ item }: { item: number }) => {
    const y = useMotionValue(0)
    const hue = item * 90

    return (
        <Reorder.Item
            value={item}
            id={`item-${item}`}
            data-testid={`item-${item}`}
            style={{
                y,
                height: 50,
                marginBottom: 10,
                borderRadius: 8,
                listStyle: "none",
                cursor: "grab",
                background: `hsl(${hue}, 70%, 50%)`,
            }}
        />
    )
}

export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const scale = parseFloat(params.get("scale") || "0.5")
    const corrected = params.get("corrected") === "true"

    const ref = useRef<HTMLDivElement>(null)
    const [items, setItems] = useState(initialItems)

    const group = (
        <Reorder.Group
            axis="y"
            onReorder={setItems}
            values={items}
            id="reorder-group"
            style={{ listStyle: "none", padding: 0, margin: 0, width: 280 }}
        >
            {items.map((item) => (
                <Item key={item} item={item} />
            ))}
        </Reorder.Group>
    )

    return (
        <div
            ref={ref}
            id="scaled-parent"
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 300,
                height: 600,
                padding: 10,
                boxSizing: "border-box",
                background: "#222",
                transform: `scale(${scale})`,
                transformOrigin: "top left",
            }}
        >
            <Wrapper corrected={corrected} parentRef={ref}>
                {group}
            </Wrapper>
            <style>{styles}</style>
        </div>
    )
}

const Wrapper = ({
    corrected,
    parentRef,
    children,
}: {
    corrected: boolean
    parentRef: React.RefObject<HTMLDivElement | null>
    children: ReactNode
}) =>
    corrected ? (
        <MotionConfig transformPagePoint={correctParentTransform(parentRef)}>
            {children}
        </MotionConfig>
    ) : (
        <>{children}</>
    )

const styles = `
body {
  margin: 0;
  padding: 0;
  background: #ffaa00;
}
`
