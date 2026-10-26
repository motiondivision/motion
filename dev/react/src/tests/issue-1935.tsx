import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * #1935: the docs' tabs example with a sidebar that appears when Lettuce is
 * selected. The window is centred, so the sidebar shifts the tabs left in the
 * same render as the shared `layoutId` underline moves to Lettuce. The tab
 * list is a `layoutRoot`, so the underline should animate relative to it, not
 * from where Tomato was on the page before the shift.
 *
 * Every frame from the click onwards, window.records gets the left and top
 * edges of the underlines (in document order) and of the tab list, and
 * whether React has rendered the click yet.
 *
 * ?exit=true keeps the old underline mounted while it fades out, so the two
 * crossfade. ?outside=true starts the underline in a box outside the list.
 * ?layoutRoot=false makes the list a plain element. ?offset=true moves the
 * whole window with a translate on an ancestor of the list.
 * ?layout=position (or size) makes Lettuce wider and sets the underline's
 * layout prop. ?outsideX=<px> translates the outside box. ?innerX=<px> wraps
 * Tomato's underline in a translated box inside its tab, within the list.
 * ?scroll=<px> puts the tabs in a scrolled layoutScroll box in the list.
 * ?underlineX=<px> translates the underlines. ?offsetScale=<n> also scales
 * the ?offset ancestor.
 */
const tabs = ["🍅 Tomato", "🥬 Lettuce", "🧀 Cheese"]

declare global {
    interface Window {
        records: {
            underlines: number[]
            underlineTops: number[]
            underlineWidths: number[]
            list: number
            listTop: number
            rendered: boolean
        }[]
        recording: boolean
    }
}

window.records = []

function record() {
    if (!window.recording) return
    const underlines = Array.from(
        document.querySelectorAll(".underline"),
        (u) => u.getBoundingClientRect()
    )
    const list = document.querySelector("ul")!.getBoundingClientRect()
    window.records.push({
        underlines: underlines.map(({ left }) => left),
        underlineTops: underlines.map(({ top }) => top),
        underlineWidths: underlines.map(({ width }) => width),
        list: list.left,
        listTop: list.top,
        rendered: Boolean(document.querySelector("aside")),
    })
    requestAnimationFrame(record)
}

const transition = { duration: 1, ease: "linear" } as const

export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const layoutRoot = params.get("layoutRoot") !== "false"
    // Keep the old underline mounted while it exits, so the two crossfade
    const exit = params.get("exit") === "true"
    // Start with the underline in a box outside the tab list
    const outside = params.get("outside") === "true"
    // Translate an ancestor of the layoutRoot, and scale it by offsetScale
    const offset = params.get("offset") === "true"
    const offsetScale = Number(params.get("offsetScale") || 1)
    // Translate the box outside the tab list
    const outsideX = parseInt(params.get("outsideX") || "0")
    // Only animate the underline's position or size, to a wider tab
    const layoutType = params.get("layout") as "position" | "size" | null
    // Translate a box around Tomato's underline, inside the list
    const innerX = parseInt(params.get("innerX") || "0")
    // Scroll the tabs inside a layoutScroll box in the list by this many px
    const scroll = parseInt(params.get("scroll") || "0")
    // Translate the underlines themselves
    const underlineX = parseInt(params.get("underlineX") || "0")
    const [selected, setSelected] = useState(outside ? "" : tabs[0])
    const [showSidebar, setShowSidebar] = useState(false)

    useEffect(() => {
        if (scroll) document.querySelector(".scroller")!.scrollLeft = scroll
    }, [])

    const underline = (item: string) => (
        <AnimatePresence>
            {item === selected ? (
                <motion.div
                    className="underline"
                    layoutId="underline"
                    layout={layoutType || undefined}
                    style={{ x: underlineX }}
                    exit={exit ? { opacity: 0 } : undefined}
                    transition={transition}
                />
            ) : null}
        </AnimatePresence>
    )

    const tabItems = tabs.map((item) => (
        <li
            key={item}
            id={item.split(" ")[1].toLowerCase()}
            className={layoutType ? "wide" : undefined}
            onClick={() => {
                window.recording = true
                requestAnimationFrame(record)
                setShowSidebar(item === tabs[1])
                setSelected(item)
            }}
        >
            {item}
            {item === tabs[0] && innerX ? (
                <motion.div className="inner" style={{ x: innerX }}>
                    {underline(item)}
                </motion.div>
            ) : (
                underline(item)
            )}
        </li>
    ))

    const content = (
        <div className="window">
            {outside ? (
                <motion.div className="outside" style={{ x: outsideX }}>
                    <AnimatePresence>
                        {selected ? null : (
                            <motion.div
                                className="underline"
                                layoutId="underline"
                                exit={exit ? { opacity: 0 } : undefined}
                                transition={transition}
                            />
                        )}
                    </AnimatePresence>
                </motion.div>
            ) : null}
            <nav>
                <motion.ul layout={layoutRoot} layoutRoot={layoutRoot}>
                    {scroll ? (
                        <motion.div className="scroller" layoutScroll>
                            {tabItems}
                            <li />
                        </motion.div>
                    ) : (
                        tabItems
                    )}
                </motion.ul>
            </nav>
            {showSidebar ? <aside /> : null}
            <style>{styles}</style>
        </div>
    )

    return offset ? (
        <motion.div style={{ x: 50, y: 50, scale: offsetScale }}>
            {content}
        </motion.div>
    ) : (
        content
    )
}

const styles = `
body {
    margin: 0;
}
.window {
    display: flex;
    justify-content: center;
    padding-top: 50px;
}
ul {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
}
li, .outside {
    position: relative;
    width: 100px;
    height: 40px;
    cursor: pointer;
}
.underline {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: blue;
}
.scroller {
    display: flex;
    width: 300px;
    overflow-x: scroll;
}
.scroller li {
    flex-shrink: 0;
}
.inner {
    position: absolute;
    inset: 0;
}
#lettuce.wide {
    width: 160px;
}
aside {
    width: 300px;
    height: 40px;
    background: #eee;
}
`
