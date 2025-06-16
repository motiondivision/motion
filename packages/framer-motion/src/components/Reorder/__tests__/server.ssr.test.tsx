import { useState } from "react"
import { renderToStaticMarkup, renderToString } from "react-dom/server"
import { Reorder } from ".."

describe("Reorder", () => {
    it("Correctly renders HTML", () => {
        const Component = () => (
            <Reorder.Group as="article" onReorder={() => {}} values={[]}>
                <Reorder.Item as="main" value={0} />
            </Reorder.Group>
        )

        const staticMarkup = renderToStaticMarkup(<Component />)
        const string = renderToString(<Component />)

        const expectedMarkup = `<article><main draggable="false" style="z-index:unset;transform:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;touch-action:pan-x"></main></article>`

        expect(staticMarkup).toBe(expectedMarkup)
        expect(string).toBe(expectedMarkup)
    })

    it("onReorder is typed correctly", () => {
        const Component = () => {
            const [_items, setItems] = useState(["a"])
            return (
                <Reorder.Group as="article" onReorder={setItems} values={[]}>
                    <Reorder.Item as="main" value={0} />
                </Reorder.Group>
            )
        }

        const staticMarkup = renderToStaticMarkup(<Component />)
        const string = renderToString(<Component />)

        const expectedMarkup = `<article><main draggable="false" style="z-index:unset;transform:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;touch-action:pan-x"></main></article>`

        expect(staticMarkup).toBe(expectedMarkup)
        expect(string).toBe(expectedMarkup)
    })
})
