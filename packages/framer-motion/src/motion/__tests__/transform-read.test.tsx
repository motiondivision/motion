import { domAnimation, LazyMotion, m } from "../.."
import { render } from "../../jest.setup"

describe("Independent transforms", () => {
    test("animate from the computed transform", async () => {
        // JSDOM doesn't resolve a stylesheet transform to a matrix
        const getComputedStyle = jest
            .spyOn(window, "getComputedStyle")
            .mockReturnValue({
                transform: "matrix(1, 0, 0, 1, 100, 0)",
            } as CSSStyleDeclaration)

        // m without the projection feature: HTMLVisualElement doesn't read
        // the computed transform while a projection node is attached
        const x = await new Promise<number>((resolve) => {
            render(
                <LazyMotion features={domAnimation}>
                    <m.div
                        animate={{ x: 200 }}
                        transition={{ duration: 10, ease: "linear" }}
                        onUpdate={(latest) => resolve(latest.x as number)}
                    />
                </LazyMotion>
            )
        })
        getComputedStyle.mockRestore()

        expect(x).toBeGreaterThanOrEqual(100)
        expect(x).toBeLessThan(110)
    })
})
