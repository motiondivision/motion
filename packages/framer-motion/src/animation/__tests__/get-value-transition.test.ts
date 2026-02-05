import { getValueTransition } from "motion-dom"

describe("getValueTransition", () => {
    it("returns value-specific transition as-is without inherit", () => {
        const transition = {
            duration: 1,
            opacity: { duration: 2 },
        }
        const result = getValueTransition(transition, "opacity")
        expect(result).toEqual({ duration: 2 })
    })

    it("returns base transition when no value-specific key exists", () => {
        const transition = { duration: 1, ease: "easeIn" }
        const result = getValueTransition(transition, "opacity")
        expect(result).toEqual({ duration: 1, ease: "easeIn" })
    })

    it("falls back to default key", () => {
        const transition = {
            duration: 1,
            default: { duration: 3 },
        }
        const result = getValueTransition(transition, "opacity")
        expect(result).toEqual({ duration: 3 })
    })

    it("merges value-specific with base transition when inherit is true", () => {
        const transition = {
            duration: 1,
            ease: "easeIn" as const,
            opacity: { inherit: true, duration: 2 },
        }
        const result = getValueTransition(transition, "opacity")
        expect(result.duration).toBe(2)
        expect(result.ease).toBe("easeIn")
    })

    it("strips inherit key from merged result", () => {
        const transition = {
            duration: 1,
            opacity: { inherit: true, duration: 2 },
        }
        const result = getValueTransition(transition, "opacity")
        expect(result).not.toHaveProperty("inherit")
    })

    it("inner keys win when merging with inherit", () => {
        const transition = {
            duration: 1,
            ease: "easeIn" as const,
            opacity: { inherit: true, duration: 2, ease: "easeOut" as const },
        }
        const result = getValueTransition(transition, "opacity")
        expect(result.duration).toBe(2)
        expect(result.ease).toBe("easeOut")
    })

    it("does not merge when inherit is on the base transition itself (fallback case)", () => {
        const transition = {
            inherit: true,
            duration: 1,
        }
        const result = getValueTransition(transition, "opacity")
        expect(result).toBe(transition)
    })
})
