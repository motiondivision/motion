import { render } from "@testing-library/react"
import { AnimationGeneratorName } from "motion-dom"
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
