import { render } from "@testing-library/react"
import { useContext } from "react";
import { LayoutGroup, LayoutProvider } from "../index"
import { LayoutGroupContext } from "../../../context/LayoutGroupContext"

const Consumer = ({ id = "1" }: any) => {
    const value = useContext(LayoutGroupContext)
    return <div data-testid={id}>{value.id}</div>
}
it("if it's the first LayoutGroup it sets the group id", () => {
    const tree = (
        <LayoutGroup id={"a"}>
            <Consumer />
        </LayoutGroup>
    )

    const { getByTestId } = render(tree)

    expect(getByTestId("1").textContent).toBe("a")
})

it("if it's a nested LayoutGroup it appends to the group id", () => {
    const tree = (
        <LayoutGroup id={"a"}>
            <LayoutGroup id={"b"}>
                <Consumer />
            </LayoutGroup>
        </LayoutGroup>
    )

    const { getByTestId } = render(tree)

    expect(getByTestId("1").textContent).toBe("a-b")
})

it("if the value of id is undefined, it doesn't change the group id", () => {
    const tree = (
        <LayoutGroup id={"a"}>
            <LayoutGroup id={undefined}>
                <Consumer />
            </LayoutGroup>
        </LayoutGroup>
    )

    const { getByTestId } = render(tree)

    expect(getByTestId("1").textContent).toBe("a")
})

it("if the parent group id is undefined, child LayoutGroups still append the group id", () => {
    const tree = (
        <LayoutGroup id={"a"}>
            <LayoutGroup id={undefined}>
                <LayoutGroup id={"b"}>
                    <Consumer />
                </LayoutGroup>
            </LayoutGroup>
        </LayoutGroup>
    )

    const { getByTestId } = render(tree)

    expect(getByTestId("1").textContent).toBe("a-b")
})

it("LayoutProvider is an alias for LayoutGroup", () => {
    expect(LayoutProvider).toBe(LayoutGroup)
})

it("LayoutProvider works as a drop-in replacement for LayoutGroup", () => {
    const tree = (
        <LayoutProvider id={"a"}>
            <LayoutProvider id={"b"}>
                <Consumer />
            </LayoutProvider>
        </LayoutProvider>
    )

    const { getByTestId } = render(tree)

    expect(getByTestId("1").textContent).toBe("a-b")
})

it("LayoutProvider and LayoutGroup can be nested interchangeably", () => {
    const tree = (
        <LayoutGroup id={"a"}>
            <LayoutProvider id={"b"}>
                <Consumer />
            </LayoutProvider>
        </LayoutGroup>
    )

    const { getByTestId } = render(tree)

    expect(getByTestId("1").textContent).toBe("a-b")
})
