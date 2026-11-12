import { getSpringOptions } from "../../../animation/generators/spring"
import { pointToProgressVelocity, resolveAutoMass } from "../layout-velocity"

describe("layout velocity conversions", () => {
    test("a curved path takes the velocity along its chord", () => {
        // Chord from (100, 0) to the layout. Velocity straight down the
        // chord at 100px/s is 1000 progress/s, perpendicular is 0.
        expect(pointToProgressVelocity(100, 0, { x: -100, y: 0 })).toBe(1000)
        expect(pointToProgressVelocity(100, 0, { x: 0, y: 300 })).toBe(-0)
        expect(pointToProgressVelocity(0, 0, { x: 100, y: 100 })).toBe(0)
    })
})

describe("resolveAutoMass", () => {
    test("mass follows element size", () => {
        const onComplete = () => {}
        const resolve = (size: number) =>
            resolveAutoMass(
                {
                    type: "spring",
                    visualDuration: 0.45,
                    bounce: 0.2,
                    mass: "auto",
                    onComplete,
                },
                size
            ) as any
        const small = resolve(30)
        const card = resolve(300)
        const hero = resolve(2000)
        expect(small.mass).toBe(0.25)
        expect(card.mass).toBe(1)
        expect(hero.mass).toBe(2)
        expect(card.onComplete).toBe(onComplete)
        expect(getSpringOptions(card).isTimeDefined).toBe(false)

        // Same stiffness, and every size keeps the same damping ratio
        expect(small.stiffness).toBe(hero.stiffness)
        const ratio = ({ stiffness, damping, mass }: any) =>
            damping / (2 * Math.sqrt(stiffness * mass))
        expect(ratio(small)).toBeCloseTo(ratio(card))
        expect(ratio(hero)).toBeCloseTo(ratio(card))
    })

    test("works with physics springs", () => {
        const resolve = (size: number) =>
            resolveAutoMass(
                { type: "spring", stiffness: 400, damping: 30, mass: "auto" },
                size
            ) as any
        const small = resolve(75)
        const big = resolve(600)
        expect(small).toMatchObject({ stiffness: 400, damping: 15, mass: 0.25 })
        expect(big.mass).toBe(2)
        expect(big.damping).toBeCloseTo(30 * Math.SQRT2)
    })

    test("works with duration springs", () => {
        const resolved = resolveAutoMass(
            { type: "spring", duration: 0.5, bounce: 0.2, mass: "auto" },
            300
        ) as any
        expect(resolved.stiffness).toBeGreaterThan(0)
        expect(getSpringOptions(resolved).isTimeDefined).toBe(false)
    })
})
