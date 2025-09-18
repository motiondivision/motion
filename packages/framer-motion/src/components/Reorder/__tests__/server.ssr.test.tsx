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
            const [, setItems] = useState(["a"])
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

    it("HTML props have incorrect types - these should fail TypeScript checking", () => {
        // Test correct HTML props work
        const CorrectComponent = () => (
            <Reorder.Group
                as="article"
                onReorder={() => {}}
                values={[]}
                className="test-class"
                id="test-id"
                style={{ color: "red" }}
                onClick={() => {}}
                data-testid="reorder-group"
            >
                <Reorder.Item
                    as="main"
                    value={0}
                    className="item-class"
                    id="item-id"
                    style={{ margin: "10px" }}
                    onClick={() => {}}
                    data-testid="reorder-item"
                />
            </Reorder.Group>
        )

        expect(() => renderToStaticMarkup(<CorrectComponent />)).not.toThrow()

        // These incorrect prop types should cause TypeScript errors but currently don't
        // The @ts-expect-error comments demonstrate the type system failure

        // Group with incorrect prop types - these should be TypeScript errors
        const BadGroupComponent1 = () => (
            <Reorder.Group
                as="article"
                onReorder={() => {}}
                values={[]}
                // @ts-expect-error - className should be string, not number
                className={1}
            >
                <Reorder.Item as="main" value={0} />
            </Reorder.Group>
        )

        const BadGroupComponent2 = () => (
            <Reorder.Group
                as="article"
                onReorder={() => {}}
                values={[]}
                // @ts-expect-error - id should be string, not boolean
                id={true}
            >
                <Reorder.Item as="main" value={0} />
            </Reorder.Group>
        )

        const BadGroupComponent3 = () => (
            <Reorder.Group
                as="article"
                onReorder={() => {}}
                values={[]}
                // @ts-expect-error - onClick should be function, not string
                onClick="test"
            >
                <Reorder.Item as="main" value={0} />
            </Reorder.Group>
        )

        // Item with incorrect prop types - these should be TypeScript errors
        const BadItemComponent1 = () => (
            <Reorder.Group as="article" onReorder={() => {}} values={[]}>
                <Reorder.Item
                    as="main"
                    value={0}
                    // @ts-expect-error - className should be string, not number
                    className={1}
                />
            </Reorder.Group>
        )

        const BadItemComponent2 = () => (
            <Reorder.Group as="article" onReorder={() => {}} values={[]}>
                <Reorder.Item
                    as="main"
                    value={0}
                    // @ts-expect-error - style should be object, not string
                    style="invalid-style"
                />
            </Reorder.Group>
        )

        const BadItemComponent3 = () => (
            <Reorder.Group as="article" onReorder={() => {}} values={[]}>
                <Reorder.Item
                    as="main"
                    value={0}
                    // @ts-expect-error - onClick should be function, not string
                    onClick="test"
                />
            </Reorder.Group>
        )

        // These components demonstrate that the type system isn't catching HTML prop type errors
        // In a properly typed system, the above components would fail to compile
        expect(() => renderToStaticMarkup(<BadGroupComponent1 />)).not.toThrow()
        expect(() => renderToStaticMarkup(<BadGroupComponent2 />)).not.toThrow()
        expect(() => renderToStaticMarkup(<BadGroupComponent3 />)).not.toThrow()
        expect(() => renderToStaticMarkup(<BadItemComponent1 />)).not.toThrow()
        expect(() => renderToStaticMarkup(<BadItemComponent2 />)).not.toThrow()
        expect(() => renderToStaticMarkup(<BadItemComponent3 />)).not.toThrow()
    })
})
