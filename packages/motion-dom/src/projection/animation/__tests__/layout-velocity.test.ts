import { getSpringOptions } from "../../../animation/generators/spring"
import { resolveAutoMass } from "../layout-velocity"

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
