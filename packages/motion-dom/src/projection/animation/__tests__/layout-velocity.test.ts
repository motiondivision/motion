import { getSpringOptions } from "../../../animation/generators/spring"
import {
    pointToProgressVelocity,
    toVelocityTransition,
} from "../layout-velocity"

describe("layout velocity conversions", () => {
    test("a curved path takes the velocity along its chord", () => {
        // Chord from (100, 0) to the layout. Velocity straight down the
        // chord at 100px/s is 1000 progress/s, perpendicular is 0.
        expect(pointToProgressVelocity(100, 0, { x: -100, y: 0 })).toBe(1000)
        expect(pointToProgressVelocity(100, 0, { x: 0, y: 300 })).toBe(-0)
        expect(pointToProgressVelocity(0, 0, { x: 100, y: 100 })).toBe(0)
    })
})

describe("toVelocityTransition", () => {
    test("the default layout tween stays a tween", () => {
        const tween = { duration: 0.45, ease: [0.4, 0, 0.1, 1] }
        expect(toVelocityTransition(tween)).toBe(tween)
    })

    test("time-defined springs resolve to physics", () => {
        const onComplete = () => {}
        const fromVisual = toVelocityTransition({
            type: "spring",
            visualDuration: 0.5,
            bounce: 0.2,
            onComplete,
        }) as any
        expect(fromVisual.stiffness).toBeGreaterThan(0)
        expect(getSpringOptions(fromVisual).isTimeDefined).toBe(false)
        expect(fromVisual.onComplete).toBe(onComplete)

        const fromDuration = toVelocityTransition({
            type: "spring",
            duration: 0.5,
            bounce: 0.2,
        }) as any
        expect(fromDuration.duration).toBeUndefined()
        expect(fromDuration.stiffness).toBeGreaterThan(0)
        expect(getSpringOptions(fromDuration).isTimeDefined).toBe(false)
    })

    test("physics springs keep their physics", () => {
        const transition = toVelocityTransition({
            type: "spring",
            stiffness: 300,
            damping: 20,
            mass: 2,
        })
        expect(transition).toMatchObject({
            type: "spring",
            stiffness: 300,
            damping: 20,
            mass: 2,
        })
    })

    test("other transitions are unchanged", () => {
        const tween = { duration: 0.3, ease: "linear" }
        expect(toVelocityTransition(tween)).toBe(tween)
        const inertia = { type: "inertia" }
        expect(toVelocityTransition(inertia)).toBe(inertia)
        const instant = { type: "spring", duration: 0 }
        expect(toVelocityTransition(instant)).toBe(instant)
        const untyped = { duration: 0.3, bounce: 0.4 }
        expect(toVelocityTransition(untyped)).toBe(untyped)
    })

    test("mass auto follows element size", () => {
        const resolve = (size: number) =>
            toVelocityTransition(
                {
                    type: "spring",
                    visualDuration: 0.45,
                    bounce: 0.2,
                    mass: "auto",
                },
                size
            ) as any
        const small = resolve(30)
        const card = resolve(300)
        const hero = resolve(2000)
        expect(small.mass).toBe(0.25)
        expect(card.mass).toBe(1)
        expect(hero.mass).toBe(2)

        // Same stiffness, and every size keeps the same damping ratio
        expect(small.stiffness).toBe(hero.stiffness)
        const ratio = ({ stiffness, damping, mass }: any) =>
            damping / (2 * Math.sqrt(stiffness * mass))
        expect(ratio(small)).toBeCloseTo(ratio(card))
        expect(ratio(hero)).toBeCloseTo(ratio(card))
    })

    test("mass auto works with physics springs", () => {
        const resolve = (size: number) =>
            toVelocityTransition(
                { type: "spring", stiffness: 400, damping: 30, mass: "auto" },
                size
            ) as any
        const small = resolve(75)
        const big = resolve(600)
        expect(small).toMatchObject({ stiffness: 400, damping: 15, mass: 0.25 })
        expect(big.mass).toBe(2)
        expect(big.damping).toBeCloseTo(30 * Math.SQRT2)
    })

    test("springs without mass auto keep their mass", () => {
        const transition = toVelocityTransition(
            { type: "spring", visualDuration: 0.5, bounce: 0.2 },
            2000
        ) as any
        expect(transition.mass).toBe(1)
    })
})
