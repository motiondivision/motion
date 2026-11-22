import { motionValue } from "motion-dom"
import { createAppearAnimation } from "../css"

const linear = { duration: 2, ease: "linear" } as const
const make = (props: any, latest: any = props.initial) =>
    createAppearAnimation(props, { ...latest }, null, undefined) as any

describe("createAppearAnimation", () => {
    test("makes one CSS animation for each property", () => {
        const appear = make({
            initial: { opacity: 0, x: -100, backgroundColor: "#f00" },
            animate: { opacity: 1, x: 0, backgroundColor: "#00f" },
            transition: { ...linear, delay: 0.5 },
        })!

        expect(appear.list.join(",")).toBe(
            "m-opacity 2s linear 0.5s both,m-translate 2s linear 0.5s both,m-background-color 2s linear 0.5s both,m-hold 1s both"
        )
        // --m is how a page turns its CSS enter animations off
        expect(appear.style.animation).toBe(`var(--m,${appear.list.join(",")})`)
        expect(appear.style["--m-opacity"]).toBe(1)
        expect(appear.style["--m-translate-from"]).toBe("-100px 0px 0px")
        expect(appear.style["--m-translate"]).toBe("0px 0px 0px")
        expect(appear.style["--m-background-color"]).toBe("#00f")
        expect(appear.rules).toEqual({
            "m-opacity": "@keyframes m-opacity{to{opacity:var(--m-opacity)}}",
            "m-translate":
                "@keyframes m-translate{from{translate:var(--m-translate-from)}to{translate:var(--m-translate)}}",
            "m-background-color":
                "@keyframes m-background-color{to{background-color:var(--m-background-color)}}",
            "m-hold": "@keyframes m-hold{from,to{transform:none}}",
        })
        expect(appear.from).toEqual({
            opacity: 0,
            x: -100,
            backgroundColor: "#f00",
        })
    })

    test("gives translate, scale and rotate their own timing", () => {
        const appear = make({
            initial: { x: -100, y: 20, scale: 0.5, rotate: 10 },
            animate: { x: 0, y: 0, scale: 1, rotate: 10 },
            transition: {
                ...linear,
                scale: { duration: 1, ease: "easeIn", delay: 0.2 },
            },
        })!

        // A property that doesn't animate still shows its value, as the
        // transform style is held at none
        expect(appear.list.join(",")).toBe(
            "m-translate 2s linear 0s both,m-scale 1s ease-in 0.2s both,m-rotate 1s both,m-hold 1s both"
        )
        expect(appear.style["--m-translate-from"]).toBe("-100px 20px 0px")
        expect(appear.style["--m-scale-from"]).toBe(0.5)
        expect(appear.style["--m-scale"]).toBe(1)
        expect(appear.style["--m-rotate-from"]).toBe("10deg")
        expect(appear.style["--m-rotate"]).toBe("10deg")
        expect(appear.transform).toEqual([
            "m-translate",
            "m-scale",
            "m-rotate",
            "m-hold",
        ])
        expect(appear.timings["m-translate"].keys).toEqual(["x", "y"])
    })

    test("x and y springs over other distances share a timing", () => {
        const appear = make({
            initial: { x: -100, y: 20, scale: 0.5 },
            animate: { x: 0, y: 0, scale: 1 },
        })!

        expect(appear.transform).toEqual(["m-translate", "m-scale", "m-hold"])
        expect(appear.timings["m-translate"].keys).toEqual(["x", "y"])
    })

    test("animates the transform as one when its values can't be split", () => {
        // x and y are one property, so can't have timings of their own
        const timings = make({
            initial: { x: -100, y: 20 },
            animate: { x: 0, y: 0 },
            transition: { x: linear, y: { duration: 1, ease: "linear" } },
        })!

        expect(timings.list.join(",")).toBe("m-transform 2s linear 0s both")
        expect(timings.style["--m-transform"]).toBe("none")
        expect(timings.transform).toEqual(["m-transform"])
        expect(timings.timings["m-transform"].keys).toEqual(["x", "y"])

        // Values that translate, scale and rotate can't show
        const skew = make({
            initial: { x: -100, skewX: 10 },
            animate: { x: 50, skewX: 0 },
            transition: linear,
        })!

        expect(skew.list.join(",")).toBe("m-transform 2s linear 0s both")
        expect(skew.style["--m-transform"]).toBe("translateX(50px)")
        expect(skew.rules["m-transform"]).toBe(
            "@keyframes m-transform{to{transform:var(--m-transform)}}"
        )

        // A transform with a unit, or a template
        expect(
            make({
                initial: { x: -100 },
                animate: { x: 0 },
                transformTemplate: (_: unknown, generated: string) => generated,
            })!.transform
        ).toEqual(["m-transform"])
    })

    test("gives a spring as a linear() easing", () => {
        const appear = make({ initial: { x: -100 }, animate: { x: 0 } })!

        expect(appear.list.join(",")).toMatch(
            /^m-translate [\d.]+s linear\(0( 0%)?, .+\) 0s both,m-hold 1s both$/
        )
    })

    test("uses a value's own transition, and bezier and named easings", () => {
        const appear = make({
            initial: { opacity: 0, height: 0 },
            animate: { opacity: 1, height: 100 },
            transition: {
                duration: 1,
                ease: [0.1, 0.2, 0.3, 0.4],
                height: { duration: 3, ease: "easeIn" },
            },
        })!

        expect(appear.list.join(",")).toBe(
            "m-opacity 1s cubic-bezier(0.1, 0.2, 0.3, 0.4) 0s both,m-height 3s ease-in 0s both"
        )
        expect(appear.style["--m-height"]).toBe("100px")
    })

    test("resolves variants, with their transition", () => {
        const appear = make(
            {
                variants: {
                    hidden: { opacity: 0 },
                    visible: { opacity: 1, transition: linear },
                },
                initial: "hidden",
                animate: "visible",
            },
            { opacity: 0 }
        )!

        expect(appear.list.join(",")).toBe("m-opacity 2s linear 0s both")
    })

    test("records what each animation plays, for the animation code", () => {
        const appear = make({
            initial: { x: -100, scale: 0.5, opacity: 0 },
            animate: { x: 0, scale: 1, opacity: 1 },
            transition: linear,
        })!

        expect(appear.timings["m-translate"].keys).toEqual(["x"])
        expect(appear.timings["m-scale"].keys).toEqual(["scale"])
        expect(appear.targets).toEqual({ x: 0, scale: 1, opacity: 1 })
        expect(appear.to).toEqual({ x: 0, scale: 1 })
        expect(appear.timings["m-opacity"].keys).toEqual(["opacity"])
        expect(appear.timings["m-opacity"].transition).toEqual({
            ...linear,
            delay: undefined,
        })
    })

    test("gives a transform without an initial value its default", () => {
        const appear = make({ animate: { x: 100, scale: 2 } }, {})!

        expect(appear.values).toEqual({ x: 0, scale: 1 })
        expect(appear.style["--m-translate-from"]).toBe("0px 0px 0px")
        expect(appear.style["--m-translate"]).toBe("100px 0px 0px")
        expect(appear.style["--m-scale-from"]).toBe(1)
        expect(appear.style["--m-scale"]).toBe(2)
    })

    test("says why CSS can't run an enter animation in full", () => {
        const initial = { opacity: 0 }
        const animate = { opacity: 1 }
        const from = { x: -100 }
        const to = { x: 0 }

        expect(make({ initial, animate: { opacity: [0, 0.5, 1] } })).toBe(
            "keyframes of opacity"
        )
        expect(
            make({ initial, animate, transition: { repeat: Infinity } })
        ).toBe("the transition of opacity")
        expect(
            make({ initial, animate, transition: { ease: (v: number) => v } })
        ).toBe("the transition of opacity")

        expect(make({ initial, animate, transition: { duration: 0 } })).toBe(
            "the transition of opacity"
        )

        // Reports of every frame, and readers of a motion value
        expect(make({ initial, animate, onUpdate: () => {} })).toBe("onUpdate")
        expect(
            make({ initial, animate, style: { opacity: motionValue(0) } })
        ).toBe("opacity")

        // A transform that layout or drag also moves, or that has a unit
        expect(make({ initial: from, animate: to }).list).toBeTruthy()
        expect(make({ initial: from, animate: to, layout: true })).toBe(
            "x with layout or drag"
        )
        expect(make({ initial: from, animate: to, drag: "x" })).toBe(
            "x with layout or drag"
        )
        expect(make({ initial: from, animate: { x: "50%" } })).toBe("x")
        expect(make({ animate: { height: 100 } }, {})).toBe(
            "height without an initial value"
        )
        expect(
            make({ initial, animate, style: { animation: "spin 1s" } })
        ).toBe("an animation style")
    })

    test("makes nothing when there's no enter animation", () => {
        const initial = { opacity: 0 }
        const animate = { opacity: 1 }

        expect(make({ initial: false, animate }, {})).toBe(undefined)
        expect(make({ initial }, initial)).toBe(undefined)
        expect(
            createAppearAnimation(
                { initial, animate },
                { opacity: 0 },
                { initial: false } as any,
                undefined
            )
        ).toBe(undefined)
    })
})
