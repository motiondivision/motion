import { act, createRef } from "react"
import { AnimatePresence, motion } from "../../.."
import { render } from "@testing-library/react"
import { nextFrame } from "../../../gestures/__tests__/utils"

const hasPopRule = (doc: Document) =>
    Array.from(doc.head.querySelectorAll("style")).some((style) =>
        Array.from(style.sheet?.cssRules ?? []).some((rule) =>
            rule.cssText.includes("data-motion-pop-id")
        )
    )

/**
 * Regression test for #2319.
 *
 * When a React tree renders into another document (e.g. a window opened via
 * `window.open()` or an iframe), PopChild injected its sizing style into the
 * global `document.head`, where it never applies to the popped element.
 */
describe("AnimatePresence popLayout in a separate document", () => {
    test("injects the pop style into the element's own document", async () => {
        const iframe = document.createElement("iframe")
        document.body.appendChild(iframe)
        const iframeDocument = iframe.contentDocument!
        const container = iframeDocument.createElement("div")
        iframeDocument.body.appendChild(container)

        const ref = createRef<HTMLDivElement>()

        const Component = ({ isVisible }: { isVisible: boolean }) => (
            <AnimatePresence mode="popLayout">
                {isVisible && (
                    <motion.div
                        ref={ref}
                        style={{ width: "50px", height: "50px" }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                    />
                )}
            </AnimatePresence>
        )

        const { rerender } = render(<Component isVisible />, { container })
        rerender(<Component isVisible />)

        await nextFrame()

        const element = ref.current!
        expect(element.ownerDocument).toBe(iframeDocument)

        await act(async () => {
            rerender(<Component isVisible={false} />)
        })

        await nextFrame()

        expect(element.dataset.motionPopId).toBeDefined()
        expect(
            iframe.contentWindow!.getComputedStyle(element).position
        ).toBe("absolute")
        expect(hasPopRule(document)).toBe(false)
        expect(hasPopRule(iframeDocument)).toBe(true)

        iframe.remove()
    })
})
