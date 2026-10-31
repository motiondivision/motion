import { animate, stagger } from "motion"
import { scopeMotion } from "motion/remix"

export function App() {
    return () => (
        <ul
            id="scope"
            mix={scopeMotion(() => {
                animate(
                    "li",
                    { opacity: [0, 1] },
                    { duration: 1, ease: "linear", delay: stagger(0.5) }
                )
            })}
        >
            <li>one</li>
            <li>two</li>
        </ul>
    )
}
