import { render } from "@testing-library/react"
import { AnimationGeneratorName, Transition } from "motion-dom"
import { useContext } from "react"
import { MotionConfig } from ".."
import { MotionConfigContext } from "../../../context/MotionConfigContext"

const consumerId = "consumer"

const Consumer = () => {
    const value = useContext(MotionConfigContext)
    return (
        <div data-testid={consumerId}>{value.transition!.type as string}</div>
    )
}

const TransitionConsumer = () => {
    const value = useContext(MotionConfigContext)
    return (
        <div data-testid={consumerId}>
            {JSON.stringify(value.transition)}
        </div>
    )
}

const App = ({ type }: { type: AnimationGeneratorName }) => (
    <MotionConfig transition={{ type }}>
        <Consumer />
    </MotionConfig>
)

it("Passes down transition", () => {
    const { getByTestId } = render(<App type="spring" />)

    expect(getByTestId(consumerId).textContent).toBe("spring")
})

it("Passes down transition changes", () => {
    const { getByTestId, rerender } = render(<App type="spring" />)
    rerender(<App type="tween" />)

    expect(getByTestId(consumerId).textContent).toBe("tween")
})

it("Nested MotionConfig without inheritTransition fully replaces parent transition", () => {
    const { getByTestId } = render(
        <MotionConfig transition={{ type: "spring", duration: 1 }}>
            <MotionConfig transition={{ delay: 0.5 }}>
                <TransitionConsumer />
            </MotionConfig>
        </MotionConfig>
    )

    const transition: Transition = JSON.parse(
        getByTestId(consumerId).textContent!
    )
    expect(transition.delay).toBe(0.5)
    expect(transition.type).toBeUndefined()
    expect(transition.duration).toBeUndefined()
})

it("Nested MotionConfig with inheritTransition shallow-merges with parent transition", () => {
    const { getByTestId } = render(
        <MotionConfig transition={{ type: "spring", duration: 1 }}>
            <MotionConfig inheritTransition transition={{ delay: 0.5 }}>
                <TransitionConsumer />
            </MotionConfig>
        </MotionConfig>
    )

    const transition: Transition = JSON.parse(
        getByTestId(consumerId).textContent!
    )
    expect(transition.type).toBe("spring")
    expect(transition.duration).toBe(1)
    expect(transition.delay).toBe(0.5)
})

it("inheritTransition inner keys win over parent keys", () => {
    const { getByTestId } = render(
        <MotionConfig transition={{ type: "spring", duration: 1 }}>
            <MotionConfig
                inheritTransition
                transition={{ duration: 2, delay: 0.5 }}
            >
                <TransitionConsumer />
            </MotionConfig>
        </MotionConfig>
    )

    const transition: Transition = JSON.parse(
        getByTestId(consumerId).textContent!
    )
    expect(transition.type).toBe("spring")
    expect(transition.duration).toBe(2)
    expect(transition.delay).toBe(0.5)
})

it("inheritTransition cascades through deeply nested MotionConfigs", () => {
    const { getByTestId } = render(
        <MotionConfig transition={{ type: "spring", duration: 1 }}>
            <MotionConfig inheritTransition transition={{ delay: 0.5 }}>
                <MotionConfig
                    inheritTransition
                    transition={{ ease: "easeIn" }}
                >
                    <TransitionConsumer />
                </MotionConfig>
            </MotionConfig>
        </MotionConfig>
    )

    const transition: Transition = JSON.parse(
        getByTestId(consumerId).textContent!
    )
    expect(transition.type).toBe("spring")
    expect(transition.duration).toBe(1)
    expect(transition.delay).toBe(0.5)
    expect(transition.ease).toBe("easeIn")
})
