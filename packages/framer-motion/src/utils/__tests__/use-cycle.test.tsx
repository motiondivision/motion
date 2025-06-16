import { fireEvent } from "@testing-library/react"
import { useEffect } from "react"
import { click, render } from "../../jest.setup"
import { useCycle } from "../use-cycle"

describe("useCycle", () => {
    test("cycles through given states", () => {
        const results: number[] = []

        const Component = () => {
            const [latest, cycle] = useCycle(1, 2, 3, 4)
            useEffect(() => {
                if (results[results.length - 1] !== latest) results.push(latest)
            }, [latest])

            return <div onClick={() => cycle()} />
        }

        const { container } = render(<Component />)

        click(container.firstChild as Element)
        click(container.firstChild as Element)
        click(container.firstChild as Element)
        click(container.firstChild as Element)

        expect(results).toEqual([1, 2, 3, 4, 1])
    })

    test("jumps to a given index", () => {
        let result: number = 0

        const Component = () => {
            const [latest, cycle] = useCycle(1, 2, 3, 4)
            result = latest
            return <div onClick={() => cycle(2)} />
        }

        const { container } = render(<Component />)
        fireEvent.click(container.firstChild as Element)

        expect(result).toBe(3)
    })

    test("is not functionally bound by the render cycle", () => {
        let result: number = 0

        const Component = () => {
            const [latest, cycle] = useCycle(1, 2, 3, 4)
            result = latest
            return <div onClick={() => (cycle(), cycle())} />
        }

        const { container } = render(<Component />)
        fireEvent.click(container.firstChild as Element)

        expect(result).toBe(3)
    })
})

// initial index
// cycle(index)
