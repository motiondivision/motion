import { isPrimaryPointer } from "../is-primary-pointer"

describe("isPrimaryPointer", () => {
    test("Identifies primary pointer", () => {
        expect(
            isPrimaryPointer({
                button: 1,
                isPrimary: true,
                pointerType: "mouse",
            } as any)
        ).toEqual(false)
        expect(
            isPrimaryPointer({
                button: 1,
                isPrimary: true,
                pointerType: "touch",
            } as any)
        ).toEqual(true)
        expect(
            isPrimaryPointer({
                button: 0,
                isPrimary: true,
                pointerType: "mouse",
            } as any)
        ).toEqual(true)
        expect(
            isPrimaryPointer({
                button: -1,
                isPrimary: false,
                pointerType: "mouse",
            } as any)
        ).toEqual(true)
        expect(
            isPrimaryPointer({
                button: undefined,
                isPrimary: false,
                pointerType: "mouse",
            } as any)
        ).toEqual(true)
        expect(
            isPrimaryPointer({
                button: null,
                isPrimary: false,
                pointerType: "mouse",
            } as any)
        ).toEqual(true)
    })
})
