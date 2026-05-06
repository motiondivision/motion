import { renderToString } from "react-dom/server"
import * as motion from "../../client"

describe("framer-motion/client export", () => {
    test("exports motion.create for use in React Server Components", () => {
        expect(typeof (motion as any).create).toBe("function")
    })

    test("motion.create returns a working component when called from the client export", () => {
        const CustomDiv = (motion as any).create("div")
        const output = renderToString(
            <CustomDiv initial={{ x: 100 }} style={{ opacity: 1 }} />
        )

        expect(output).toBe(
            '<div style="opacity:1;transform:translateX(100px)"></div>'
        )
    })
})
