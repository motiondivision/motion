import { getSpringOptions } from "../../../animation/generators/spring"
import {
    pixelToProgressVelocity,
    pointToProgressVelocity,
    progressToPixelVelocity,
    toVelocityTransition,
} from "../layout-velocity"

describe("layout velocity conversions", () => {
    test("pixel and progress velocity round trip", () => {
        // Box starts 200px right of its layout and moves left at 500px/s
        const progressVelocity = pixelToProgressVelocity(200, -500)
        expect(progressVelocity).toBe(2500)
        expect(progressToPixelVelocity(200, progressVelocity)).toBe(-500)
    })

    test("an axis that doesn't move takes no velocity", () => {
        expect(pixelToProgressVelocity(0, 1000)).toBe(0)
        expect(pixelToProgressVelocity(0.5, 1000)).toBe(0)
    })

    test("a curved path takes the velocity along its chord", () => {
        // Chord from (100, 0) to the layout. Velocity straight down the
        // chord at 100px/s is 1000 progress/s, perpendicular is 0.
        expect(pointToProgressVelocity(100, 0, { x: -100, y: 0 })).toBe(1000)
        expect(pointToProgressVelocity(100, 0, { x: 0, y: 300 })).toBe(-0)
        expect(pointToProgressVelocity(0, 0, { x: 100, y: 100 })).toBe(0)
    })
})

describe("toVelocityTransition", () => {
    const defaultEase = [0.4, 0, 0.1, 1]

    test("the default layout tween becomes a physics spring", () => {
        const onComplete = () => {}
        const transition = toVelocityTransition(
            { duration: 0.45, ease: defaultEase, onComplete } as any,
            defaultEase
        ) as any
        expect(transition.type).toBe("spring")
        expect(transition.stiffness).toBeGreaterThan(0)
        expect(transition.damping).toBeGreaterThan(0)
        expect(transition.duration).toBeUndefined()
        expect(getSpringOptions(transition).isTimeDefined).toBe(false)
        expect(transition.onComplete).toBe(onComplete)
    })

    test("time-defined springs resolve to physics", () => {
        const fromVisual = toVelocityTransition(
            { type: "spring", visualDuration: 0.5, bounce: 0.2 } as any,
            defaultEase
        ) as any
        expect(fromVisual.stiffness).toBeGreaterThan(0)
        expect(getSpringOptions(fromVisual).isTimeDefined).toBe(false)

        const fromDuration = toVelocityTransition(
            { type: "spring", duration: 0.5, bounce: 0.2 } as any,
            defaultEase
        ) as any
        expect(fromDuration.duration).toBeUndefined()
        expect(fromDuration.stiffness).toBeGreaterThan(0)
        expect(getSpringOptions(fromDuration).isTimeDefined).toBe(false)
    })

    test("physics springs keep their physics", () => {
        const transition = toVelocityTransition(
            { type: "spring", stiffness: 300, damping: 20, mass: 2 } as any,
            defaultEase
        ) as any
        expect(transition).toMatchObject({
            type: "spring",
            stiffness: 300,
            damping: 20,
            mass: 2,
        })
    })

    test("other tweens are unchanged", () => {
        const tween = { duration: 0.3, ease: "linear" } as any
        expect(toVelocityTransition(tween, defaultEase)).toBe(tween)
        const inertia = { type: "inertia" } as any
        expect(toVelocityTransition(inertia, defaultEase)).toBe(inertia)
    })

    test("the default spring's mass follows element size", () => {
        const resolve = (size: number) =>
            toVelocityTransition(
                { duration: 0.45, ease: defaultEase } as any,
                defaultEase,
                size
            ) as any
        const small = resolve(30)
        const card = resolve(300)
        const hero = resolve(2000)
        expect(small.mass).toBe(0.25)
        expect(card.mass).toBe(1)
        expect(hero.mass).toBe(2)

        // Same stiffness, and every size stays critically damped
        expect(small.stiffness).toBe(hero.stiffness)
        for (const { stiffness, damping, mass } of [small, card, hero]) {
            expect(damping / (2 * Math.sqrt(stiffness * mass))).toBeCloseTo(1)
        }
    })

    test("user springs keep their mass", () => {
        const transition = toVelocityTransition(
            { type: "spring", visualDuration: 0.5, bounce: 0.2 } as any,
            defaultEase,
            2000
        ) as any
        expect(transition.mass).toBe(1)
    })
})
