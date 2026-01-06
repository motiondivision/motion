import { motion } from "framer-motion"

/**
 * Test for scroll-while-drag feature.
 * Verifies that dragging elements stay attached to the cursor
 * when scrolling occurs during drag.
 *
 * URL params:
 * - window=true: Test window scroll instead of element scroll
 *
 * Note: Window scroll is automatically handled by PanSession via pageX/pageY
 * coordinates. Element scroll requires explicit compensation.
 */
export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const useWindowScroll = params.get("window") === "true"

    if (useWindowScroll) {
        // Window scroll test: draggable in a tall document
        return (
            <div style={windowContentStyle}>
                <motion.div
                    id="draggable"
                    data-testid="draggable"
                    drag
                    dragElastic={0}
                    dragMomentum={false}
                    style={boxStyle}
                />
            </div>
        )
    }

    // Element scroll test: draggable in a scrollable container
    return (
        <div
            id="scrollable"
            data-testid="scrollable"
            style={scrollableStyle}
        >
            <div style={contentStyle}>
                <motion.div
                    id="draggable"
                    data-testid="draggable"
                    drag
                    dragElastic={0}
                    dragMomentum={false}
                    style={boxStyle}
                />
            </div>
        </div>
    )
}

const scrollableStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: 500,
    height: 400,
    overflow: "auto",
    background: "#f0f0f0",
}

const contentStyle: React.CSSProperties = {
    height: 1500,
    width: 800,
    paddingTop: 50,
    paddingLeft: 50,
}

const windowContentStyle: React.CSSProperties = {
    height: 2000,
    width: "100%",
    paddingTop: 50,
    paddingLeft: 50,
    background: "#f0f0f0",
}

const boxStyle: React.CSSProperties = {
    width: 100,
    height: 100,
    background: "#ff0066",
    borderRadius: 10,
}
