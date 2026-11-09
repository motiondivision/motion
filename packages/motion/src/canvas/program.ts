import type { UniformInfo } from "./uniforms"

/**
 * Draws a unit quad, `aUv` from 0 to 1, as a `uSize` box placed in the
 * canvas by `uMatrix`. Both are in CSS pixels, as is `uCanvas`.
 */
const quadVertex = `#version 300 es
in vec2 aUv;
uniform mat3 uMatrix;
uniform vec2 uSize;
uniform vec2 uCanvas;
out vec2 vUv;
void main() {
vUv = aUv;
vec3 p = uMatrix * vec3(aUv * uSize, 1.0);
gl_Position = vec4(p.x / uCanvas.x * 2.0 - 1.0, 1.0 - p.y / uCanvas.y * 2.0, 0.0, 1.0);
}`

const fragmentHead = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
uniform vec2 uSize;
uniform float uTime;
uniform float uAlpha;
`

const defaultShader = `vec4 effect(vec2 uv) { return texture(uTexture, uv); }`

/**
 * Covers the target with a texture of the same size, to composite the
 * motion blur buffer.
 */
const copyVertex = `#version 300 es
in vec2 aUv;
out vec2 vUv;
void main() { vUv = aUv; gl_Position = vec4(aUv * 2.0 - 1.0, 0.0, 1.0); }`

const copyFragment = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
void main() { outColor = texture(uTexture, vUv); }`

export interface Program {
    program: WebGLProgram
    uniforms: Map<string, UniformInfo>
    /**
     * Whether the shader reads `uTime`, so needs drawing every frame.
     */
    usesTime: boolean
}

export function compileProgram(
    gl: WebGL2RenderingContext,
    vertex: string,
    fragment: string
): Program {
    const program = gl.createProgram()!

    for (const [type, source] of [
        [gl.VERTEX_SHADER, vertex],
        [gl.FRAGMENT_SHADER, fragment],
    ] as const) {
        const shader = gl.createShader(type)!
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader) || "Shader error")
        }
        gl.attachShader(program, shader)
        gl.deleteShader(shader)
    }

    gl.bindAttribLocation(program, 0, "aUv")
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Shader error")
    }

    const uniforms = new Map<string, UniformInfo>()
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)

    for (let i = 0; i < count; i++) {
        const { name, type, size } = gl.getActiveUniform(program, i)!
        uniforms.set(name.replace(/\[0\]$/, ""), {
            location: gl.getUniformLocation(program, name)!,
            type,
            size,
        })
    }

    return { program, uniforms, usesTime: uniforms.has("uTime") }
}

/**
 * The program that draws elements with `shader`, a GLSL ES 3.00 function
 * `vec4 effect(vec2 uv)` returning a premultiplied colour.
 */
export const compileElementProgram = (
    gl: WebGL2RenderingContext,
    shader = defaultShader
) =>
    compileProgram(
        gl,
        quadVertex,
        fragmentHead +
            shader +
            `\nvoid main() { outColor = effect(vUv) * uAlpha; }`
    )

export const compileCopyProgram = (gl: WebGL2RenderingContext) =>
    compileProgram(gl, copyVertex, copyFragment)

/**
 * Uniforms the layer sets itself, so element uniforms can't use them.
 */
export const builtInUniforms = new Set([
    "uTexture",
    "uSize",
    "uTime",
    "uAlpha",
    "uMatrix",
    "uCanvas",
])
