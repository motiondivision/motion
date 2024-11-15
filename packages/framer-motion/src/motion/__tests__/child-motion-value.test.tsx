import { render } from "../../../jest.setup"
import { motion } from "../../render/components/motion"
import { motionValue } from "../../value"
import { frame } from "../../frameloop"

describe("child as motion value", () => {
    test("accepts motion values as children", async () => {
        const promise = new Promise<HTMLDivElement>((resolve) => {
            const child = motionValue(1)
            const Component = () => <motion.div>{child}</motion.div>
            const { container, rerender } = render(<Component />)
            rerender(<Component />)
            resolve(container.firstChild as HTMLDivElement)
        })

        return expect(promise).resolves.toHaveTextContent("1")
    })

    test("accepts motion values as children for motion.text inside an svg", async () => {
        const promise = new Promise<SVGTextElement>((resolve) => {
            const child = motionValue(3)
            const Component = () => <svg><motion.text>{child}</motion.text></svg>
            const { container, rerender } = render(<Component />)
            rerender(<Component />)
            resolve(container.firstChild?.firstChild as SVGTextElement)
        })

        return expect(promise).resolves.toHaveTextContent("3")
    })

    test("updates textContent when motion value changes", async () => {
        const promise = new Promise<HTMLDivElement>((resolve) => {
            const child = motionValue(1)
            const Component = () => <motion.div>{child}</motion.div>
            const { container, rerender } = render(<Component />)
            rerender(<Component />)

            frame.postRender(() => {
                child.set(2)

                frame.postRender(() => {
                    resolve(container.firstChild as HTMLDivElement)
                })
            })
        })

        return expect(promise).resolves.toHaveTextContent("2")
    })

    test("updates svg text when motion value changes", async () => {
        const promise = new Promise<SVGTextElement>((resolve) => {
            const child = motionValue(3)
            const Component = () => <svg><motion.text>{child}</motion.text></svg>
            const { container, rerender } = render(<Component />)
            rerender(<Component />)

            frame.postRender(() => {
                child.set(4)

                frame.postRender(() => {
                    resolve(container.firstChild?.firstChild as SVGTextElement)
                })
            })
        })

        return expect(promise).resolves.toHaveTextContent("4")
    })
})
