import * as React from "react"
import { render } from "../../../jest.setup"
import { tagProxy } from "../tag-proxy"

describe("tagProxy", () => {
    test("Creates a component with the defined tags", () => {
        interface Props {}

        interface HTMLProps {
            div: {}
        }

        const component = tagProxy<Props, HTMLProps>(
            (as) => (props: Props) => React.createElement(as, props)
        )

        const { rerender } = render(<component.div />)
        rerender(<component.div />)
    })

    test("Creates a component that accepts underlying element props and custom props", () => {
        interface Props {
            animate: boolean
        }

        interface HTMLProps {
            div: { foo: string }
        }

        const component = tagProxy<Props, HTMLProps>(
            (as) => (props: Props) => React.createElement(as, props)
        )

        render(<component.div animate={false} foo="yeah" />)
    })

    test("Creates a component that correctly excludes overlapping props", () => {
        interface Props {
            animate: boolean
        }

        interface HTMLProps {
            div: { animate: string }
        }

        const component = tagProxy<Props, HTMLProps>(
            (as) => (props: Props) => React.createElement(as, props)
        )

        render(<component.div animate={false} />)
    })

    test("Cache works correctly", () => {
        interface Props {}

        interface HTMLTags {
            div: React.ComponentType<{
                foo: string
            }>
        }

        const component = tagProxy<Props, HTMLTags>(
            (as) => (props: Props) => React.createElement(as, props)
        )

        expect(component.div).toEqual(component.div)
    })

    test("Creates custom component when used as a function", () => {
        interface Props {
            animate: boolean
        }

        interface HTMLTags {
            div: React.ComponentType<{
                foo: string
            }>
        }

        interface CustomProps {
            foo: string
        }

        const component = tagProxy<Props, HTMLTags>(
            (as) => (props: Props) => React.createElement(as, props)
        )

        const CustomComponent = component<CustomProps>(() => <li />)

        const { container } = render(
            <CustomComponent animate={false} foo="yeah" />
        )
        expect((container.firstChild as HTMLElement).tagName).toEqual("LI")
    })

    test("Correctly renders the defined tag", () => {
        interface Props {}

        interface HTMLProps {
            div: {}
        }

        const component = tagProxy<Props, HTMLProps>(
            (as) => (props: Props) => React.createElement(as, props)
        )

        const { container } = render(<component.div />)
        expect((container.firstChild as HTMLElement).tagName).toEqual("DIV")
    })
})
