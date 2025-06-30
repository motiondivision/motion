import { useState, useRef } from "react"
import { Reorder, PanInfo } from "framer-motion"

const inactiveShadow = "0px 0px 0px rgba(0,0,0,0.8)"

// Increased number of items for scrolling
const initialItems = Array.from({ length: 15 }, (_, i) => `Item ${i + 1}`)

function ReorderIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 39 39"
            width="39"
            height="39"
            // onPointerDown={(e) => {
            //     dragControls.start(e)
            // }}
        >
            <path
                d="M 5 0 C 7.761 0 10 2.239 10 5 C 10 7.761 7.761 10 5 10 C 2.239 10 0 7.761 0 5 C 0 2.239 2.239 0 5 0 Z"
                fill="#CCC"
            ></path>
            <path
                d="M 19 0 C 21.761 0 24 2.239 24 5 C 24 7.761 21.761 10 19 10 C 16.239 10 14 7.761 14 5 C 14 2.239 16.239 0 19 0 Z"
                fill="#CCC"
            ></path>
            <path
                d="M 33 0 C 35.761 0 38 2.239 38 5 C 38 7.761 35.761 10 33 10 C 30.239 10 28 7.761 28 5 C 28 2.239 30.239 0 33 0 Z"
                fill="#CCC"
            ></path>
            <path
                d="M 33 14 C 35.761 14 38 16.239 38 19 C 38 21.761 35.761 24 33 24 C 30.239 24 28 21.761 28 19 C 28 16.239 30.239 14 33 14 Z"
                fill="#CCC"
            ></path>
            <path
                d="M 19 14 C 21.761 14 24 16.239 24 19 C 24 21.761 21.761 24 19 24 C 16.239 24 14 21.761 14 19 C 14 16.239 16.239 14 19 14 Z"
                fill="#CCC"
            ></path>
            <path
                d="M 5 14 C 7.761 14 10 16.239 10 19 C 10 21.761 7.761 24 5 24 C 2.239 24 0 21.761 0 19 C 0 16.239 2.239 14 5 14 Z"
                fill="#CCC"
            ></path>
            <path
                d="M 5 28 C 7.761 28 10 30.239 10 33 C 10 35.761 7.761 38 5 38 C 2.239 38 0 35.761 0 33 C 0 30.239 2.239 28 5 28 Z"
                fill="#CCC"
            ></path>
            <path
                d="M 19 28 C 21.761 28 24 30.239 24 33 C 24 35.761 21.761 38 19 38 C 16.239 38 14 35.761 14 33 C 14 30.239 16.239 28 19 28 Z"
                fill="#CCC"
            ></path>
            <path
                d="M 33 28 C 35.761 28 38 30.239 38 33 C 38 35.761 35.761 38 33 38 C 30.239 38 28 35.761 28 33 C 28 30.239 30.239 28 33 28 Z"
                fill="#CCC"
            ></path>
        </svg>
    )
}

// Removed verticalList, horizontalList, and the extensive 'styles' const.
// Basic styling for li and ul will be inherited or can be added minimally if needed.
// The main focus is the scrollable div.

// Minimal styles for Reorder.Item (li) to make it visible and distinct
// These are typically part of a larger stylesheet in a real app.
const itemStyles = `
li {
  border-radius: 5px;
  margin-bottom: 10px;
  width: 95%; /* Adjust to fit within parent with padding */
  padding: 15px 20px;
  background: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  box-shadow: 0px 2px 5px rgba(0,0,0,0.1);
  margin-left: auto; /* Center items if ul is wider */
  margin-right: auto; /* Center items if ul is wider */
}

li span {
  font-family: sans-serif;
  font-size: 18px;
  font-weight: 600;
}

li svg {
    width: 18px;
    height: 18px;
    cursor: grab;
    fill: #888;
}
`
// Note: The broken "export const App = () => { ... }" that was inside itemStyles
// and the duplicated App definition are removed by this replacement.
// The next valid part of the file should be the correct 'export const App = () => {'

export const App = () => {
    const [items, setItems] = useState(initialItems)
    const scrollableParentRef = useRef<HTMLDivElement>(null)
    const isScrollingRef = useRef<boolean>(false)
    const scrollDirectionRef = useRef<"up" | "down" | null>(null)
    const animationFrameRef = useRef<number | null>(null)

    const SCROLL_SPEED = 10 // px per frame
    const SCROLL_THRESHOLD = 50 // px from edge

    const stopScrolling = () => {
        isScrollingRef.current = false
        scrollDirectionRef.current = null
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = null
        }
    }

    const startScrolling = () => {
        if (isScrollingRef.current) return // Already scrolling

        isScrollingRef.current = true

        const scrollLoop = () => {
            if (!scrollableParentRef.current || !scrollDirectionRef.current) {
                stopScrolling()
                return
            }

            if (scrollDirectionRef.current === "up") {
                scrollableParentRef.current.scrollTop -= SCROLL_SPEED
            } else if (scrollDirectionRef.current === "down") {
                scrollableParentRef.current.scrollTop += SCROLL_SPEED
            }

            // Continue scrolling as long as the condition holds
            if (isScrollingRef.current) {
                animationFrameRef.current = requestAnimationFrame(scrollLoop)
            }
        }
        animationFrameRef.current = requestAnimationFrame(scrollLoop)
    }

    const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (!scrollableParentRef.current) return

        const parent = scrollableParentRef.current
        const parentRect = parent.getBoundingClientRect()
        const pointerY = info.point.y

        let newScrollDirection: "up" | "down" | null = null

        if (pointerY < parentRect.top + SCROLL_THRESHOLD) {
            newScrollDirection = "up"
        } else if (pointerY > parentRect.bottom - SCROLL_THRESHOLD) {
            newScrollDirection = "down"
        }

        if (newScrollDirection) {
            scrollDirectionRef.current = newScrollDirection
            if (!isScrollingRef.current) {
                startScrolling()
            }
        } else {
            if (isScrollingRef.current) {
                stopScrolling()
            }
        }
    }

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        stopScrolling()
    }

    return (
        <div
            ref={scrollableParentRef}
            style={{
                width: "300px",
                height: "300px",
                overflowY: "scroll",
                border: "2px solid blue",
                background: "#f0f0f0", // Background for the scrollable area
                padding: "10px", // Padding for items inside
                boxSizing: "border-box",
            }}
        >
            <Reorder.Group
                axis="y"
                onReorder={setItems}
                values={items}
                // The original template had ul { width: 300px }.
                // The parent div is now 300px. Reorder.Group (ul) should fill it.
                style={{ position: "relative", width: "100%" }}
            >
                {items.map((item) => (
                    // The Item component itself is a Reorder.Item
                    // So we pass onDrag and onDragEnd to it directly
                    <Reorder.Item
                        key={item}
                        value={item}
                        onDrag={handleDrag}
                        onDragEnd={handleDragEnd}
                        // Copied style from Item component for consistency, removing individual y and boxShadow
                        // Reorder.Item will handle its y offset internally during drag.
                        // Custom boxShadow can be added if needed.
                        style={{
                            boxShadow: inactiveShadow, // Apply initial shadow
                            // y: useMotionValue(0) // This should be handled by Reorder.Item
                            // Let's use the styles from the original Item component for visual consistency
                            borderRadius: "5px",
                            marginBottom: "10px",
                            width: "100%", // Take full width of the Reorder.Group
                            padding: "15px 20px",
                            background: "white",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexShrink: 0,
                        }}
                        transition={{ duration: 0.1 }}
                    >
                        <span>{item}</span>
                        <ReorderIcon />
                    </Reorder.Item>
                ))}
                <style>{itemStyles}</style>
            </Reorder.Group>
        </div>
    )
}
