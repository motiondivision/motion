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
            "translate3d(100px, 300px, 0px) scale(2, 4)"
        )

        expect(buildProjectionTransform(delta, { x: 2, y: 0.5 })).toEqual(
            "translate3d(50px, 600px, 0px) scale(0.5, 2) scale(4, 2)"
        )

        expect(
            buildProjectionTransform(delta, { x: 2, y: 0.5 }, { rotate: 45 })
        ).toEqual(
            "translate3d(50px, 600px, 0px) scale(0.5, 2) rotate(45deg) scale(4, 2)"
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
            "translate3d(50px, 150px, 0px) scale(0.5, 0.5) rotate(90deg) "
        )
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
        ).toEqual("translate3d(100px, 100px, 0px) rotate(10deg) scale(2, 4)")
    })
})
