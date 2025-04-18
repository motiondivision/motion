import { useEffect } from "react"
import { render } from "../../../jest.setup"
import { useAnimatedState } from "../use-animated-state"

describe("useAnimatedState", () => {
    test("animates values", async () => {
        const promise = new Promise((resolve) => {
            const Component = () => {
                const [state, setState] = useAnimatedState({ foo: 0 })

                useEffect(() => {
                    setState({
                        foo: 100,
                        transition: { duration: 0.05 },
                    })
                }, [])

                useEffect(() => {
                    if (state.foo === 100) resolve(state.foo)
                }, [state.foo])

                return <div />
            }

            render(<Component />)
        })

        await expect(promise).resolves.toEqual(100)
    })
})
