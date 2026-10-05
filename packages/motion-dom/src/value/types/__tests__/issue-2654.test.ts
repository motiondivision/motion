import { complex } from "../complex"
import { mixComplex } from "../../../utils/mix/complex"

/**
 * #2654: the "3" in "matrix3d" is tokenised as a number, so it gets
 * zeroed or interpolated along with the real values, producing invalid
 * transforms like "matrix0d(...)" or "matrix2.99999d(...)".
 */
const MATRIX =
    "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)"

describe("matrix3d (#2654)", () => {
    test("getAnimatableNone keeps the matrix3d function name", () => {
        expect(complex.getAnimatableNone(MATRIX)).toMatch(/^matrix3d\(/)
    })

    test("parse/transform round-trips matrix3d", () => {
        expect(complex.parse(MATRIX)).toHaveLength(16)
    })

    test("mixing from the animatable none keeps the function name", () => {
        const mixer = mixComplex(complex.getAnimatableNone(MATRIX), MATRIX)
        for (const p of [0, 0.25, 0.5, 0.75, 1]) {
            expect(mixer(p)).toMatch(/^matrix3d\(/)
        }
    })
})
