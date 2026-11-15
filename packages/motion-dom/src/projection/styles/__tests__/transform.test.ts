import { buildProjectionTransform } from "../transform"
import { createDelta } from "../../geometry/models"

describe("buildProjectionTransform", () => {
    it("Returns 'none' when no transform required", () => {
        expect(buildProjectionTransform(createDelta(), { x: 1, y: 1 })).toEqual(
            "none"
        )
    })

    it("Creates the expected transform for the provided arguments", () => {
        const delta = {
            x: {
                translate: 100,
                scale: 2,
                origin: 0.5,
                originPoint: 100,
            },
            y: {
                translate: 300,
                scale: 4,
                origin: 0.5,
                originPoint: 100,
            },
        }
        expect(buildProjectionTransform(delta, { x: 1, y: 1 })).toEqual(
            "translate(100px, 300px) scale(2, 4)"
        )

        expect(buildProjectionTransform(delta, { x: 2, y: 0.5 })).toEqual(
            "translate(50px, 600px) scale(2, 4)"
        )

        expect(
            buildProjectionTransform(delta, { x: 2, y: 0.5 }, { rotate: 45 })
        ).toEqual(
            "translate(50px, 600px) scale(0.5, 2) rotate(45deg) scale(4, 2)"
        )

        expect(
            buildProjectionTransform(
                {
                    x: {
                        translate: 100,
                        scale: 0.5,
                        origin: 0.5,
                        originPoint: 100,
                    },
                    y: {
                        translate: 300,
                        scale: 0.5,
                        origin: 0.5,
                        originPoint: 100,
                    },
                },
                { x: 2, y: 2 },
                { rotate: 90 }
            )
        ).toEqual(
            "translate(50px, 150px) scale(0.5, 0.5) rotate(90deg) "
        )
    })

    it("Applies rotateZ (#2611)", () => {
        expect(
            buildProjectionTransform(
                createDelta(),
                { x: 1, y: 1 },
                { rotateX: 10, rotateY: 20, rotateZ: 45 }
            )
        ).toEqual("rotateX(10deg) rotateY(20deg) rotateZ(45deg) ")
    })

    it("Doesn't apply unneccessary translation", () => {
        const delta = {
            x: {
                translate: 0,
                scale: 2,
                origin: 0.5,
                originPoint: 100,
            },
            y: {
                translate: 0,
                scale: 4,
                origin: 0.5,
                originPoint: 100,
            },
        }

        expect(
            buildProjectionTransform(delta, { x: 2, y: 4 }, { rotate: 10 })
        ).toEqual("scale(0.5, 0.25) rotate(10deg) scale(4, 16)")
    })

    it("Doesn't apply unneccessary tree scale", () => {
        const delta = {
            x: {
                translate: 100,
                scale: 2,
                origin: 0.5,
                originPoint: 100,
            },
            y: {
                translate: 100,
                scale: 4,
                origin: 0.5,
                originPoint: 100,
            },
        }

        expect(
            buildProjectionTransform(delta, { x: 1, y: 1 }, { rotate: 10 })
        ).toEqual("translate(100px, 100px) rotate(10deg) scale(2, 4)")
    })

    it("Combines tree scale correction and element scale when there's no rotation", () => {
        const delta = {
            x: {
                translate: 100,
                scale: 2,
                origin: 0.5,
                originPoint: 100,
            },
            y: {
                translate: 100,
                scale: 4,
                origin: 0.5,
                originPoint: 100,
            },
        }

        expect(buildProjectionTransform(delta, { x: 2, y: 4 }, {})).toEqual(
            "translate(50px, 25px) scale(2, 4)"
        )

        expect(
            buildProjectionTransform(delta, { x: 2, y: 4 }, { scale: 3 })
        ).toEqual("translate(50px, 25px) scale(2, 4)")
    })

    it("Doesn't apply a scale when the tree scale is all there is to correct", () => {
        const delta = createDelta()
        delta.x.translate = 100

        expect(buildProjectionTransform(delta, { x: 2, y: 4 })).toEqual(
            "translate(50px, 0px) "
        )
    })

    test("Keeps a scale inside a scaled tree when the delta is the identity", () => {
        const delta = {
            x: { translate: 0, scale: 1, origin: 0.5, originPoint: 0 },
            y: { translate: 0, scale: 1, origin: 0.5, originPoint: 0 },
        }
        expect(buildProjectionTransform(delta, { x: 0.25, y: 0.5 })).toBe(
            "scale(1, 1)"
        )
        expect(buildProjectionTransform(delta, { x: 1, y: 1 })).toBe("none")
    })

    test("Writes a 2D translate when there's no z, so elements aren't promoted to their own layers", () => {
        const delta = createDelta()
        delta.x.translate = 100
        delta.y.translate = 50

        expect(buildProjectionTransform(delta, { x: 1, y: 1 })).toBe(
            "translate(100px, 50px) "
        )
        expect(buildProjectionTransform(delta, { x: 1, y: 1 }, {})).toBe(
            "translate(100px, 50px) "
        )
    })

    test("Keeps translate3d when z is set", () => {
        const delta = createDelta()
        delta.x.translate = 100

        expect(buildProjectionTransform(delta, { x: 1, y: 1 }, { z: 20 })).toBe(
            "translate3d(100px, 0px, 20px) "
        )
        expect(
            buildProjectionTransform(createDelta(), { x: 1, y: 1 }, { z: 20 })
        ).toBe("translate3d(0px, 0px, 20px) ")
    })
})
