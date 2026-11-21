import { appearRule, createAppearAnimation } from "../css"

const linear = { duration: 2, ease: "linear" } as const
const make = (props: any, latest: any = props.initial) =>
    createAppearAnimation(props, { ...latest }, null, undefined)

describe("createAppearAnimation", () => {
    test("makes one CSS animation for each property", () => {
        const appear = make({
            initial: { opacity: 0, x: -100, backgroundColor: "#f00" },
            animate: { opacity: 1, x: 0, backgroundColor: "#00f" },
            transition: { ...linear, delay: 0.5 },
        })!

        expect(appear.style.animation).toBe(
            "m-opacity 2s linear 0.5s both,m-transform 2s linear 0.5s both,m-background-color 2s linear 0.5s both"
        )
        expect(appear.style["--m-opacity"]).toBe(1)
        expect(appear.style["--m-transform"]).toBe("none")
        expect(appear.style["--m-background-color"]).toBe("#00f")
        expect(appear.properties).toEqual({
            "m-opacity": "opacity",
            "m-transform": "transform",
            "m-background-color": "background-color",
        })
        expect(appearRule("background-color")).toBe(
            "@keyframes m-background-color{to{background-color:var(--m-background-color)}}"
        )
    })

    test("gives a spring as a linear() easing", () => {
        const appear = make({ initial: { x: -100 }, animate: { x: 0 } })!

        expect(appear.style.animation).toMatch(
            /^m-transform [\d.]+s linear\(0( 0%)?, .+\) 0s both$/
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

        expect(appear.style.animation).toBe(
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

        expect(appear.style.animation).toBe("m-opacity 2s linear 0s both")
    })

    test("gives a transform without an initial value its default", () => {
        const appear = make({ animate: { x: 100, scale: 2 } }, {})!

        expect(appear.values).toEqual({ x: 0, scale: 1 })
        expect(appear.style["--m-transform"]).toBe(
            "translateX(100px) scale(2)"
        )
    })

    test("leaves what CSS can't run in full to the animation code", () => {
        const initial = { opacity: 0 }
        const animate = { opacity: 1 }

        expect(make({ initial, animate: { opacity: [0, 0.5, 1] } })).toBe(
            undefined
        )
        expect(
            make({ initial, animate, transition: { repeat: Infinity } })
        ).toBe(undefined)
        expect(
            make({ initial, animate, transition: { ease: (v: number) => v } })
        ).toBe(undefined)
        expect(make({ initial, animate, transition: { duration: 0 } })).toBe(
            undefined
        )
        expect(make({ initial: false, animate }, {})).toBe(undefined)
        expect(make({ initial }, initial)).toBe(undefined)
        expect(make({ animate: { height: 100 } }, {})).toBe(undefined)
        expect(
            make({ initial, animate, style: { animation: "spin 1s" } })
        ).toBe(undefined)
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
