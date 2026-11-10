import type { MotionValue } from "framer-motion/dom"
import type { CanvasUniform } from "./uniforms"

/**
 * One entry of `shaders`. Made by `shader()`, `motionBlur()` or one of
 * the effects.
 */
export interface FXShader {
    /**
     * WGSL with `fn effect(uv: vec2f) -> vec4f`. `element(uv)` reads the
     * result of everything before it, and `layer.size` is the size of
     * the canvas in CSS pixels.
     */
    wgsl?: string

    /**
     * Values for the members of the shader's `Uniforms`, read each frame.
     */
    uniforms?: Record<string, CanvasUniform>

    /**
     * Set by `motionBlur()`. Motion blur is drawn per element, before the
     * shaders, because it needs to know how each one moved.
     */
    motionBlur?: number
    samples?: number
}

type Option = number | MotionValue<number>

/**
 * A shader of your own, run on the full result of `<motion-fx>`.
 *
 * ```javascript
 * shader(`
 *   struct Uniforms { amount: f32 }
 *   fn effect(uv: vec2f) -> vec4f {
 *     return element(uv + vec2f(sin(uv.y * 40.0) * uniforms.amount, 0.0));
 *   }
 * `, { amount })
 * ```
 */
export const shader = (
    wgsl: string,
    uniforms?: Record<string, CanvasUniform>
): FXShader => ({ wgsl, uniforms })

export interface MotionBlurOptions {
    /**
     * How long the shutter stays open, from `0` to `1` (the whole frame).
     * Defaults to `0.5`.
     */
    strength?: number

    /**
     * The most poses averaged for one element. Defaults to `24`.
     */
    samples?: number
}

/**
 * Blur each child along the path it moved in the last frame.
 */
export const motionBlur = ({
    strength = 0.5,
    samples,
}: MotionBlurOptions = {}): FXShader => ({ motionBlur: strength, samples })

/**
 * Split the red and blue channels apart by `amount` pixels along `angle`
 * (in degrees).
 */
export const chromaticAberration = ({
    amount = 4,
    angle = 0,
}: { amount?: Option; angle?: Option } = {}) =>
    shader(
        `struct Uniforms { amount: f32, angle: f32 }
fn effect(uv: vec2f) -> vec4f {
  let a = radians(uniforms.angle);
  let d = vec2f(cos(a), sin(a)) * uniforms.amount / layer.size;
  let r = element(uv + d);
  let g = element(uv);
  let b = element(uv - d);
  return vec4f(r.r, g.g, b.b, max(g.a, max(r.a, b.a)));
}`,
        { amount, angle }
    )

/**
 * Draw in square cells of `size` pixels.
 */
export const pixelate = ({ size = 8 }: { size?: Option } = {}) =>
    shader(
        `struct Uniforms { size: f32 }
fn effect(uv: vec2f) -> vec4f {
  let cell = max(uniforms.size, 1.0) / layer.size;
  return element((floor(uv / cell) + 0.5) * cell);
}`,
        { size }
    )

/**
 * Merge shapes that are near each other, like drops of liquid. `blur` is
 * how far they reach, in pixels.
 */
export const goo = ({
    blur = 16,
    threshold = 0.5,
}: { blur?: Option; threshold?: Option } = {}) =>
    shader(
        `struct Uniforms { blur: f32, threshold: f32 }
fn effect(uv: vec2f) -> vec4f {
  var sum = vec4f(0.0);
  var total = 0.0;
  for (var x = -4; x <= 4; x++) {
    for (var y = -4; y <= 4; y++) {
      let o = vec2f(f32(x), f32(y)) / 4.0;
      let w = exp(-dot(o, o) * 3.0);
      sum += element(uv + o * uniforms.blur / layer.size) * w;
      total += w;
    }
  }
  let c = sum / total;
  let sharp = element(uv);
  let a = smoothstep(uniforms.threshold - 0.04, uniforms.threshold + 0.04, c.a);
  let fill = vec4f(c.rgb / max(c.a, 0.0001), 1.0) * a;
  return sharp + fill * (1.0 - sharp.a);
}`,
        { blur, threshold }
    )
