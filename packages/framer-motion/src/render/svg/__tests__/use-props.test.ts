import { renderHook } from "@testing-library/react"
import { motionValue } from "motion-dom"
import { useSVGProps } from "../use-props"

describe("SVG useProps", () => {
    test("should return correct styles for element", () => {
        const { result } = renderHook(() =>
            useSVGProps(
                {
                    attrX: 1,
                    attrY: motionValue(5),
                    attrScale: 3,
                    cx: 2,
                    style: {
                        x: 3,
                        scale: 4,
                    },
                } as any,
                {
                    attrX: 6,
                    attrY: 10,
                    attrScale: 4,
                    cx: 7,
                    x: 8,
                    scale: 9,
                },
                false,
                "path"
            )
        )

        expect(result.current).toStrictEqual({
            x: "6px",
            y: "10px",
            scale: "4",
            cx: "7",
            style: {
                transform: "translateX(8px) scale(9)",
                transformBox: "fill-box",
                transformOrigin: "50% 50%",
            },
        })
    })

    test("should return correct styles for element with pathLength", () => {
        const { result } = renderHook(() =>
            useSVGProps(
                { style: {} } as any,
                {
                    pathLength: 0.5,
                },
                false,
                "path"
            )
        )

        // Uses unitless values to avoid Safari zoom bug
        expect(result.current).toStrictEqual({
            pathLength: "1",
            strokeDasharray: "0.5 0.5",
            style: {},
        })
    })

    test("should correctly remove props as motionvalues", () => {
        const { result } = renderHook(() =>
            useSVGProps(
                { y: motionValue(2) } as any,
                { attrY: 3 },
                false,
                "path"
            )
        )

        expect(result.current).toStrictEqual({
            y: "3px",
            style: {},
        })
    })

    test("should keep offsetDistance as CSS style, not SVG attribute", () => {
        const { result } = renderHook(() =>
            useSVGProps(
                { style: {} } as any,
                {
                    offsetDistance: "50%",
                    offsetPath: "path('M 0 0 L 100 100')",
                },
                false,
                "circle"
            )
        )

        expect(result.current).toStrictEqual({
            style: {
                offsetDistance: "50%",
                offsetPath: "path('M 0 0 L 100 100')",
            },
        })
    })

    test("should keep all CSS motion path properties as styles", () => {
        const { result } = renderHook(() =>
            useSVGProps(
                { style: {} } as any,
                {
                    offsetDistance: "25%",
                    offsetPath: "path('M 0 0 L 100 100')",
                    offsetRotate: "auto",
                    offsetAnchor: "center",
                },
                false,
                "rect"
            )
        )

        expect(result.current).toStrictEqual({
            style: {
                offsetDistance: "25%",
                offsetPath: "path('M 0 0 L 100 100')",
                offsetRotate: "auto",
                offsetAnchor: "center",
            },
        })
    })

    test("reflects style prop changes between renders", () => {
        const visualState = { x: 8 }
        const { result, rerender } = renderHook(
            ({ style }) =>
                useSVGProps({ style } as any, visualState, false, "rect"),
            { initialProps: { style: { fill: "red", x: 8 } as any } }
        )

        expect(result.current.style).toEqual({
            fill: "red",
            transform: "translateX(8px)",
            transformBox: "fill-box",
            transformOrigin: "50% 50%",
        })

        rerender({ style: { fill: "blue", x: 8 } })

        expect(result.current.style).toEqual({
            fill: "blue",
            transform: "translateX(8px)",
            transformBox: "fill-box",
            transformOrigin: "50% 50%",
        })
    })
})
