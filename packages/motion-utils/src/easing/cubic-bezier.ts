/*
  Bezier function generator
  This has been modified from Gaëtan Renaudeau's BezierEasing
  https://github.com/gre/bezier-easing/blob/master/src/index.js
  https://github.com/gre/bezier-easing/blob/master/LICENSE

  At creation, x(t) is sampled at t = i / 32. Linear interpolation
  between these samples gives a guess of t at each x = j / 32. Each call
  interpolates a start value of t from these guesses, then takes two
  Newton-Raphson steps. On typical curves, t is then within ~1e-10 of
  the exact solution.

  If the two steps do not converge quadratically, which happens near flat
  parts of the curve, the call falls back to Newton-Raphson safeguarded
  by a bisection bracket, which converges to full precision. The output
  stays within ~1e-8 of the exact curve and is smooth, not snapped to a
  grid.

  x <= 0 and x >= 1 return exactly 0 and 1.
  Usage
    const easeOut = cubicBezier(.17,.67,.83,.67);
    const x = easeOut(0.5); // returns 0.627...
*/

import { noop } from "../noop"

// Returns x(t) given t, x1, and x2, or y(t) given t, y1, and y2.
// Bernstein form, so it is exactly 0 at t = 0 and exactly 1 at t = 1.
const calcBezier = (t: number, a1: number, a2: number) =>
    t * (3 * (1 - t) * ((1 - t) * a1 + t * a2) + t * t)

// Returns the Newton-Raphson correction to t, (x(t) - x) / x'(t)
const newtonStep = (t: number, x: number, a1: number, a2: number) =>
    (calcBezier(t, a1, a2) - x) /
    (3 * ((1 - t) * ((1 - t) * a1 + 2 * t * (a2 - a1)) + t * t * (1 - a2)))

// Number of intervals in the table of starting guesses
const samples = 32

/*#__NO_SIDE_EFFECTS__*/
export function cubicBezier(
    mX1: number,
    mY1: number,
    mX2: number,
    mY2: number
) {
    // If this is a linear gradient, return linear easing
    if (mX1 === mY1 && mX2 === mY2) return noop

    // guesses[j] is the t where x(t) ~= j / samples. Where x(t) is not
    // monotonic, entries can be missing. They give NaN, so the solver
    // below falls back to bisection.
    const guesses: number[] = []
    for (
        let i = 0, j = 0, prevX = 0, sampleX: number;
        i < samples;
        prevX = sampleX
    ) {
        sampleX = calcBezier(++i / samples, mX1, mX2)
        while (j <= samples && j / samples <= sampleX) {
            guesses[j] =
                (i - 1 + (j++ / samples - prevX) / (sampleX - prevX)) / samples
        }
    }

    return (x: number) => {
        if (!(x > 0 && x < 1)) return +(x >= 1)

        const p = x * samples
        const i = p | 0
        let t = guesses[i] + (guesses[i + 1] - guesses[i]) * (p - i)

        const step1 = newtonStep(t, x, mX1, mX2)
        const step2 = newtonStep((t -= step1), x, mX1, mX2)
        t -= step2

        /*
          If convergence is quadratic, step2 ~= k * step1^2, and the error
          that remains is ~= k * step2^2 = step2^3 / step1^2. If that is
          not small, or t is NaN or outside [0, 1], continue with
          Newton-Raphson safeguarded by a bisection bracket.
        */
        if (
            !(
                Math.abs(step2 * step2 * step2) <= 1e-10 * step1 * step1 &&
                t >= 0 &&
                t <= 1
            )
        ) {
            for (let n = 0, lowerBound = 0, upperBound = 1; n < 40; n++) {
                // If t is outside the bracket, because a Newton step
                // overshot where the slope is ~0, bisect instead.
                if (!(t >= lowerBound && t <= upperBound)) {
                    t = (lowerBound + upperBound) / 2
                }

                const currentX = calcBezier(t, mX1, mX2) - x
                if (currentX * currentX < 1e-28) break
                currentX > 0 ? (upperBound = t) : (lowerBound = t)

                t -= newtonStep(t, x, mX1, mX2)
            }

            // The last Newton step isn't checked against the bracket, so
            // keep t inside [0, 1] if every iteration ran.
            if (!(t >= 0)) t = 0
            else if (t > 1) t = 1
        }

        return calcBezier(t, mY1, mY2)
    }
}
