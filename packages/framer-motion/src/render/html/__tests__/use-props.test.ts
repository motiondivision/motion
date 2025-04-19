import { renderHook } from "@testing-library/react"
import { motionValue } from "motion-dom"
import { useHTMLProps } from "../use-props"

describe("HTML useProps", () => {
    test("should return correct styles for element", () => {
        const { result } = renderHook(() =>
            useHTMLProps(
                {
                    style: {
                        x: motionValue(1),
                        y: motionValue(2),
                    },
                },
                {
                    x: 3,
                }
            )
        )

        expect(result.current).toEqual({
            style: {
                transform: "translateX(3px)",
            },
        })
    })

    test("should disable hardware acceleration in isStatic mode", () => {
        const { result } = renderHook(() =>
            useHTMLProps(
                {
                    style: {
                        x: motionValue(1),
                        y: motionValue(2),
                    },
                },
                {
                    x: 3,
                }
            )
        )

        expect(result.current).toEqual({
            style: {
                transform: "translateX(3px)",
            },
        })
    })

    test("should generate new styles when a new visualState object is passed", () => {
        const initialState = { x: 100 } as any

        const { result, rerender } = renderHook(
            ({ state }: any) => useHTMLProps({}, state),
            { initialProps: { state: initialState } }
        )

        const a = result.current.style
        rerender({ state: initialState })
        const b = result.current.style
        rerender({ state: { x: 200 } })
        const c = result.current.style

        expect(a).toEqual(b)
        expect(a).not.toEqual(c)
        expect(a).toEqual({
            transform: "translateX(100px)",
        })
        expect(c).toEqual({
            transform: "translateX(200px)",
        })
    })

    test("should generate the correct props when drag is enabled", () => {
        const { result } = renderHook(() =>
            useHTMLProps({ drag: true }, { x: 3 })
        )

        expect(result.current).toEqual({
            draggable: false,
            style: {
                transform: "translateX(3px)",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                touchAction: "none",
            },
        })

        const { result: resultX } = renderHook(() =>
            useHTMLProps({ drag: "x" }, { x: 3 })
        )

        expect(resultX.current).toEqual({
            draggable: false,
            style: {
                transform: "translateX(3px)",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                touchAction: "pan-y",
            },
        })

        const { result: resultY } = renderHook(() =>
            useHTMLProps({ drag: "y" }, { x: 3 })
        )

        expect(resultY.current).toEqual({
            draggable: false,
            style: {
                transform: "translateX(3px)",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                touchAction: "pan-x",
            },
        })
    })
})
