import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { generateLinearEasing } from "motion-dom"
import { z } from "zod"

const description = `Generates a CSS bouncing animation using the linear() easing function.

Bounce easing works slightly differently than other animations in that
it looks better with a slightly longer duration, like 1 second.

Longer durations will look light gravity is lower or the UI is lighter, whereas 
shorter durations will look like gravity and the UI is heavier.
`

const bounce = function (t: number) {
    const n1 = 7.5625
    const d1 = 2.75

    if (t < 1 / d1) {
        return n1 * t * t
    } else if (t < 2 / d1) {
        return n1 * (t -= 1.5 / d1) * t + 0.75
    } else if (t < 2.5 / d1) {
        return n1 * (t -= 2.25 / d1) * t + 0.9375
    } else {
        return n1 * (t -= 2.625 / d1) * t + 0.984375
    }
}

const args = {
    duration: z
        .number()
        .default(1)
        .describe("Duration of the animation, in seconds."),
}

export function initGenerateBounceEasingTool(server: McpServer) {
    server.tool(
        "generate-css-bounce-easing",
        description,
        args,
        async ({ duration }) => {
            return {
                content: [
                    {
                        type: "text",
                        text: generateLinearEasing(bounce, duration * 1000, 10),
                    },
                ],
            }
        }
    )
}
