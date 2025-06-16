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
            x: 6,
            y: 10,
            scale: 4,
            cx: 7,
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

        expect(result.current).toStrictEqual({
            pathLength: 1,
            strokeDasharray: "0.5px 1px",
            strokeDashoffset: "0px",
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
            y: 3,
            style: {},
        })
    })
})
