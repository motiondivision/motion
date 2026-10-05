import { useInView } from "framer-motion"
import { useRef, useState } from "react"

/**
 * Reproduction from issue #2579: a component that renders null first, then
 * renders the ref'd element after a state change. useInView never observes
 * the element because the ref attaches after the effect ran.
 */
export const App = () => {
    const ref = useRef<HTMLDivElement>(null)
    const [isHidden, setHidden] = useState(true)
    const isInView = useInView(ref)

    return (
        <>
            <button id="show" onClick={() => setHidden(false)}>
                Show
            </button>
            <div id="in-view">{String(isInView)}</div>
            {isHidden ? null : (
                <div
                    ref={ref}
                    id="box"
                    style={{ width: 100, height: 100, background: "red" }}
                />
            )}
        </>
    )
}
