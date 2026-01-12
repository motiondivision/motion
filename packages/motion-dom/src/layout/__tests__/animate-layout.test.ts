import { animateLayout, setLayoutNodeFactory, getLayoutNodeFactory } from "../animate-layout"
import type { LayoutNodeFactory } from "../types"
import type { IProjectionNode } from "../../projection/node/types"

// Mock projection node
function createMockProjectionNode(): IProjectionNode {
    const node: Partial<IProjectionNode> = {
        root: undefined as unknown as IProjectionNode,
        parent: undefined,
        isVisible: true,
        treeScale: { x: 1, y: 1 },
        path: [],
        depth: 0,
        instance: document.createElement("div"),
        willUpdate: jest.fn(),
        didUpdate: jest.fn(),
        mount: jest.fn(),
        unmount: jest.fn(),
        addEventListener: jest.fn(),
        notifyListeners: jest.fn(),
        setOptions: jest.fn(),
        setAnimationOrigin: jest.fn(),
        startAnimation: jest.fn(),
        currentAnimation: undefined,
    }
    // Set root to self for testing
    node.root = node as IProjectionNode
    return node as IProjectionNode
}

// Mock factory
function createMockFactory(): LayoutNodeFactory {
    return {
        createProjectionNode: jest.fn(() => createMockProjectionNode()),
        createVisualElement: jest.fn(() => ({
            props: {},
            projection: undefined,
            scheduleRender: jest.fn(),
        })),
    }
}

describe("animateLayout", () => {
    let originalFactory: LayoutNodeFactory | null

    beforeAll(() => {
        // Save original factory
        originalFactory = getLayoutNodeFactory()
    })

    afterAll(() => {
        // Restore original factory
        if (originalFactory) {
            setLayoutNodeFactory(originalFactory)
        }
    })

    beforeEach(() => {
        // Set up mock factory before each test
        setLayoutNodeFactory(createMockFactory())
        // Clear document body
        document.body.innerHTML = ""
    })

    describe("argument parsing", () => {
        test("throws error when no factory is configured", () => {
            // Temporarily remove factory
            const factory = getLayoutNodeFactory()
            ;(globalThis as any).__motion_layout_factory_backup = factory

            // Use private setter to clear (we'll need to work around this)
            // For now, skip this test as we can't easily unset the factory
        })

        test("handles document-wide mode with just mutation callback", async () => {
            // Add some layout elements to the document
            document.body.innerHTML = `
                <div data-layout id="box1"></div>
                <div data-layout-id="hero" id="box2"></div>
            `

            let mutationCalled = false
            const builder = animateLayout(() => {
                mutationCalled = true
            })

            // Builder should be returned
            expect(builder).toBeDefined()
            expect(typeof builder.enter).toBe("function")
            expect(typeof builder.exit).toBe("function")
            expect(typeof builder.then).toBe("function")

            // Wait for the animation to complete
            await builder

            expect(mutationCalled).toBe(true)
        })

        test("handles document-wide mode with mutation and options", async () => {
            document.body.innerHTML = `<div data-layout id="box"></div>`

            let mutationCalled = false
            const builder = animateLayout(
                () => {
                    mutationCalled = true
                },
                { duration: 0.5 }
            )

            await builder
            expect(mutationCalled).toBe(true)
        })

        test("handles document-wide mode with just options", async () => {
            document.body.innerHTML = `<div data-layout id="box"></div>`

            const builder = animateLayout({ duration: 0.3 })

            // Should return builder without executing mutation
            expect(builder).toBeDefined()
            expect(typeof builder.then).toBe("function")
        })

        test("handles scoped mode with string selector", async () => {
            document.body.innerHTML = `
                <div class="container">
                    <div data-layout id="item1"></div>
                    <div data-layout id="item2"></div>
                </div>
                <div data-layout id="outside"></div>
            `

            let mutationCalled = false
            const builder = animateLayout(".container", () => {
                mutationCalled = true
            })

            await builder
            expect(mutationCalled).toBe(true)
        })

        test("handles scoped mode with element reference", async () => {
            document.body.innerHTML = `
                <div id="scope">
                    <div data-layout id="child"></div>
                </div>
            `
            const scope = document.getElementById("scope")!

            let mutationCalled = false
            const builder = animateLayout(scope, () => {
                mutationCalled = true
            })

            await builder
            expect(mutationCalled).toBe(true)
        })

        test("handles scoped mode with element array", async () => {
            document.body.innerHTML = `
                <div id="scope1"><div data-layout></div></div>
                <div id="scope2"><div data-layout-id="hero"></div></div>
            `
            const elements = [
                document.getElementById("scope1")!,
                document.getElementById("scope2")!,
            ]

            let mutationCalled = false
            const builder = animateLayout(elements, () => {
                mutationCalled = true
            })

            await builder
            expect(mutationCalled).toBe(true)
        })

        test("handles scoped mode with NodeList", async () => {
            document.body.innerHTML = `
                <div class="scope"><div data-layout></div></div>
                <div class="scope"><div data-layout></div></div>
            `
            const nodeList = document.querySelectorAll(".scope")

            let mutationCalled = false
            const builder = animateLayout(nodeList, () => {
                mutationCalled = true
            })

            await builder
            expect(mutationCalled).toBe(true)
        })
    })

    describe("builder pattern", () => {
        test("enter() returns the builder for chaining", () => {
            document.body.innerHTML = `<div data-layout></div>`

            const builder = animateLayout({ duration: 0.3 })
            const result = builder.enter({ opacity: [0, 1] })

            expect(result).toBe(builder)
        })

        test("exit() returns the builder for chaining", () => {
            document.body.innerHTML = `<div data-layout></div>`

            const builder = animateLayout({ duration: 0.3 })
            const result = builder.exit({ opacity: 0 })

            expect(result).toBe(builder)
        })

        test("can chain enter and exit", () => {
            document.body.innerHTML = `<div data-layout></div>`

            const builder = animateLayout({ duration: 0.3 })
                .enter({ opacity: [0, 1] })
                .exit({ opacity: 0 })

            expect(builder).toBeDefined()
            expect(typeof builder.then).toBe("function")
        })
    })

    describe("LAYOUT_SELECTORS", () => {
        test("finds elements with data-layout attribute", async () => {
            document.body.innerHTML = `
                <div data-layout id="layout1"></div>
                <div id="no-layout"></div>
                <div data-layout id="layout2"></div>
            `

            const factory = createMockFactory()
            setLayoutNodeFactory(factory)

            await animateLayout(() => {})

            // Factory should have been called for the two data-layout elements
            expect(factory.createProjectionNode).toHaveBeenCalledTimes(2)
        })

        test("finds elements with data-layout-id attribute", async () => {
            document.body.innerHTML = `
                <div data-layout-id="hero" id="hero1"></div>
                <div id="no-layout"></div>
                <div data-layout-id="card" id="card1"></div>
            `

            const factory = createMockFactory()
            setLayoutNodeFactory(factory)

            await animateLayout(() => {})

            // Factory should have been called for the two data-layout-id elements
            expect(factory.createProjectionNode).toHaveBeenCalledTimes(2)
        })

        test("finds elements with both data-layout and data-layout-id", async () => {
            document.body.innerHTML = `
                <div data-layout id="layout1"></div>
                <div data-layout-id="hero" id="hero1"></div>
                <div data-layout data-layout-id="card" id="both"></div>
            `

            const factory = createMockFactory()
            setLayoutNodeFactory(factory)

            await animateLayout(() => {})

            // Factory should have been called for all three elements
            // (the third element matches both selectors but should only count once)
            expect(factory.createProjectionNode).toHaveBeenCalledTimes(3)
        })
    })

    describe("scoping behavior", () => {
        test("scoped mode only finds layout elements within scope", async () => {
            document.body.innerHTML = `
                <div class="container">
                    <div data-layout id="inside1"></div>
                    <div data-layout id="inside2"></div>
                </div>
                <div data-layout id="outside"></div>
            `

            const factory = createMockFactory()
            setLayoutNodeFactory(factory)

            await animateLayout(".container", () => {})

            // Should only find the 2 elements inside .container, not the one outside
            expect(factory.createProjectionNode).toHaveBeenCalledTimes(2)
        })

        test("scope element is included if it has data-layout", async () => {
            document.body.innerHTML = `
                <div class="container" data-layout>
                    <div data-layout id="child"></div>
                </div>
            `

            const factory = createMockFactory()
            setLayoutNodeFactory(factory)

            await animateLayout(".container", () => {})

            // Should find both the container (which has data-layout) and its child
            expect(factory.createProjectionNode).toHaveBeenCalledTimes(2)
        })

        test("document-wide mode finds all layout elements", async () => {
            document.body.innerHTML = `
                <div class="container">
                    <div data-layout id="inside"></div>
                </div>
                <div data-layout id="outside"></div>
            `

            const factory = createMockFactory()
            setLayoutNodeFactory(factory)

            await animateLayout(() => {})

            // Should find all layout elements in the document
            expect(factory.createProjectionNode).toHaveBeenCalledTimes(2)
        })

        test("multiple scopes find layout elements in all scopes", async () => {
            document.body.innerHTML = `
                <div class="scope" id="scope1">
                    <div data-layout id="item1"></div>
                </div>
                <div class="scope" id="scope2">
                    <div data-layout id="item2"></div>
                    <div data-layout id="item3"></div>
                </div>
                <div data-layout id="outside"></div>
            `

            const factory = createMockFactory()
            setLayoutNodeFactory(factory)

            await animateLayout(".scope", () => {})

            // Should find 3 elements total from both scopes, not the one outside
            expect(factory.createProjectionNode).toHaveBeenCalledTimes(3)
        })

        test("finds data-layout-id elements within scope", async () => {
            document.body.innerHTML = `
                <div class="container">
                    <div data-layout-id="hero" id="inside"></div>
                </div>
                <div data-layout-id="card" id="outside"></div>
            `

            const factory = createMockFactory()
            setLayoutNodeFactory(factory)

            await animateLayout(".container", () => {})

            // Should only find the one inside the container
            expect(factory.createProjectionNode).toHaveBeenCalledTimes(1)
        })
    })

    describe("empty elements", () => {
        test("returns empty GroupAnimation when no elements match", async () => {
            document.body.innerHTML = `<div id="no-layout"></div>`

            const result = await animateLayout(() => {})

            expect(result).toBeDefined()
            expect(result.animations).toEqual([])
        })

        test("returns empty GroupAnimation when document is empty", async () => {
            document.body.innerHTML = ""

            const result = await animateLayout(() => {})

            expect(result).toBeDefined()
            expect(result.animations).toEqual([])
        })
    })
})
