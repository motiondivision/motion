import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { spring as generateSpring } from "motion-dom"
import { z } from "zod"

const description = `Generates a CSS spring animation using the linear() easing function.

The spring is defined by two parameters:
- Bounce: A number between 0 and 1, where 0 is no bounce and 1 is max bounce.
- Duration: The perceptual duration of the spring, defined in seconds.

It uses perceptual duration, which means the amount of time it takes for the animation
to "appear" to reach its target. This is different than the returned calculated duration,
which is the value that should be applied.

When co-ordinating this spring with other animations, use the submitted duration,
for example if someone has asked for a spring that takes 0.2 seconds, and this
returns a spring that takes 0.3 seconds, you should use the 0.2 seconds for your
*other* animations.

\`\`\`css
transition: opacity 0.2s linear, transform <output>
\`\`\`

It returns the "<duration> <easing-function>" part of a CSS transition, meaning it should
be prepended with "transition: <value-name> " to be used in a CSS stylesheet.

Quick or snappy durations are around 0.2 seconds, a normal animation between 0.3 and 0.4 seconds, while slow or sluggish durations
are around 1 second.

Note: Only use when generating CSS easing functions. Motion can import spring
directly from "motion".
`

const args = {
    bounce: z
        .number()
        .min(0)
        .max(1)
        .default(0.2)
        .describe("Bounce, defined as a number between 0 and 1."),
    duration: z
        .number()
        .default(0.4)
        .describe("Perceptual duration of the spring, defined in seconds."),
}

export function initGenerateSpringTool(server: McpServer) {
    server.tool(
        "generate-css-spring",
        description,
        args,
        async ({ bounce, duration }) => {
            const spring = generateSpring(bounce, duration)

            return {
                content: [
                    {
                        type: "text",
                        text: spring.toString(),
                    },
                ],
            }
        }
    )
}
