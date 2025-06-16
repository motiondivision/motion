import { motionValue } from "motion-dom"
import { ForwardedRef, forwardRef, Fragment, useRef, useState } from "react"
import { renderToStaticMarkup, renderToString } from "react-dom/server"
import { useMotionValue } from "../../"
import { AnimatePresence } from "../../components/AnimatePresence"
import { Reorder } from "../../components/Reorder"
import { motion } from "../../render/components/motion"
import { motion as motionProxy } from "../../render/components/motion/proxy"

const MotionFragment = motion.create(Fragment)

function runTests(render: (components: any) => string) {
    test("doesn't throw type or runtime errors", () => {
        interface CustomProps {
            foo: string
        }

        const CustomMotionComponent = motion.create(
            forwardRef(
                (props: CustomProps, ref: ForwardedRef<HTMLDivElement>) => {
                    return <div ref={ref} {...props} />
                }
            )
        )
        const CustomMotionDiv = motion.create("div")
        const CustomMotionCircle = motion.create("circle")

        const ProxyCustomMotionComponent = motionProxy.create(
            forwardRef(
                (props: CustomProps, ref: ForwardedRef<HTMLInputElement>) => {
                    return <input ref={ref} {...props} />
                }
            )
        )
        const ProxyCustomMotionDiv = motionProxy.create("div")
        const ProxyCustomMotionCircle = motionProxy.create("circle")

        function Component() {
            const divRef = useRef<HTMLDivElement>(null)
            const buttonRef = useRef<HTMLButtonElement>(null)
            const circleRef = useRef<SVGCircleElement>(null)
            const inputRef = useRef<HTMLInputElement>(null)
            const value = useMotionValue(0)
            return (
                <>
                    <motion.div
                        ref={divRef}
                        initial={{ x: 100 }}
                        whileTap={{ opacity: 0 }}
                        drag
                        layout
                        layoutId="a"
                        style={{ opacity: 1 }}
                        data-testid="box"
                    />
                    <motion.button ref={buttonRef} disabled />
                    <motion.circle ref={circleRef} cx={1} cy={value} />
                    <motionProxy.div
                        ref={divRef}
                        initial={{ x: 100 }}
                        whileTap={{ opacity: 0 }}
                        drag
                        layout
                        layoutId="a"
                        style={{ opacity: 1 }}
                        data-testid="box"
                    />
                    <motionProxy.button ref={buttonRef} disabled />
                    <motionProxy.circle ref={circleRef} cx={1} cy={value} />
                    <CustomMotionDiv
                        ref={divRef}
                        initial={{ x: 100 }}
                        whileTap={{ opacity: 0 }}
                        drag
                        layout
                        layoutId="a"
                        style={{ opacity: 1 }}
                        data-testid="box"
                    />
                    <CustomMotionComponent
                        ref={divRef}
                        foo="test"
                        whileTap={{ opacity: 0 }}
                    />
                    <CustomMotionCircle
                        ref={circleRef}
                        whileTap={{ opacity: 0 }}
                        cx={1}
                        cy={value}
                    />
                    <ProxyCustomMotionDiv
                        ref={divRef}
                        initial={{ x: 100 }}
                        whileTap={{ opacity: 0 }}
                        drag
                        layout
                        layoutId="a"
                        style={{ opacity: 1 }}
                        data-testid="box"
                    />
                    <ProxyCustomMotionComponent
                        ref={inputRef}
                        foo="test"
                        whileTap={{ opacity: 0 }}
                    />
                    <ProxyCustomMotionCircle
                        ref={circleRef}
                        whileTap={{ opacity: 0 }}
                        cx={1}
                        cy={value}
                    />
                </>
            )
        }
        render(<Component />)

        expect(true).toBe(true)
    })

    test("doesn't throw when rendering Fragment", () => {
        render(
            <MotionFragment
                initial={{ x: 100 }}
                whileTap={{ opacity: 0 }}
                drag
                layout
                layoutId="a"
                style={{ opacity: 1 }}
            />
        )

        expect(true).toBe(true)
    })
    test("correctly renders HTML", () => {
        const y = motionValue(200)
        const div = render(
            <AnimatePresence>
                <motion.div
                    initial={{ x: 100 }}
                    animate={{ x: 50 }}
                    style={{ y }}
                    exit={{ x: 0 }}
                    values={{ customValue: y }}
                />
            </AnimatePresence>
        )

        expect(div).toBe(
            '<div style="transform:translateX(100px) translateY(200px)"></div>'
        )
    })

    test("correctly renders custom HTML tag", () => {
        const y = motionValue(200)
        const CustomComponent = motion.create("element-test")
        const customElement = render(
            <AnimatePresence>
                <CustomComponent
                    initial={{ x: 100 }}
                    animate={{ x: 50 }}
                    style={{ y }}
                    exit={{ x: 0 }}
                />
            </AnimatePresence>
        )

        expect(customElement).toBe(
            '<element-test style="transform:translateX(100px) translateY(200px)"></element-test>'
        )
    })

    test("correctly renders SVG", () => {
        const cx = motionValue(100)
        const pathLength = motionValue(0.5)
        const circle = render(
            <motion.circle
                cx={cx}
                initial={{ strokeWidth: 10 }}
                style={{
                    background: "#fff",
                    pathLength,
                    x: 100,
                }}
            />
        )

        expect(circle).toBe(
            '<circle cx="100" stroke-width="10" pathLength="1" stroke-dashoffset="0px" stroke-dasharray="0.5px 1px" style="background:#fff;transform:translateX(100px);transform-origin:50% 50%;transform-box:fill-box"></circle>'
        )
        const rect = render(
            <AnimatePresence>
                <motion.rect
                    initial={{ x: 0 }}
                    animate={{ x: 100 }}
                    exit={{ x: 0 }}
                    mask=""
                    style={{
                        background: "#fff",
                    }}
                    className="test"
                    onMouseMove={() => {}}
                />
            </AnimatePresence>
        )

        expect(rect).toBe(
            '<rect mask="" class="test" style="background:#fff;transform:none;transform-origin:50% 50%;transform-box:fill-box"></rect>'
        )

        const path = render(
            <AnimatePresence>
                <motion.path
                    initial={{ x: 0 }}
                    animate={{ x: 100 }}
                    exit={{ x: 0 }}
                    mask=""
                    style={{
                        background: "#fff",
                        transformBox: "view-box",
                    }}
                    className="test"
                    onMouseMove={() => {}}
                />
            </AnimatePresence>
        )

        expect(path).toBe(
            '<path mask="" class="test" style="background:#fff;transform-box:view-box;transform:none;transform-origin:50% 50%"></path>'
        )
    })

    test("initial correctly overrides style", () => {
        const div = render(
            <motion.div initial={{ x: 100 }} style={{ x: 200 }} />
        )

        expect(div).toBe(`<div style="transform:translateX(100px)"></div>`)
    })

    test("sets tabindex='0' if onTap is set", () => {
        const div = render(<motion.div onTap={() => {}} />)

        expect(div).toBe(`<div tabindex="0"></div>`)
    })

    test("sets tabindex='0' if onTapStart is set", () => {
        const div = render(<motion.div onTap={() => {}} />)

        expect(div).toBe(`<div tabindex="0"></div>`)
    })

    test("sets tabindex='0' if whileTap is set", () => {
        const div = render(<motion.div whileTap={{ scale: 2 }} />)

        expect(div).toBe(`<div tabindex="0"></div>`)
    })

    test("doesn't override tabindex", () => {
        const div = render(<motion.div tabIndex={2} whileTap={{ scale: 2 }} />)

        expect(div).toBe(`<div tabindex="2"></div>`)
    })

    test("initial correctly overrides style with keyframes and initial={false}", () => {
        const div = render(
            <motion.div
                initial={false}
                animate={{ x: [0, 100] }}
                style={{ x: 200 }}
            />
        )

        expect(div).toBe(`<div style="transform:translateX(100px)"></div>`)
    })

    test("Reorder: Renders correct element", () => {
        function Component() {
            const [state, setState] = useState([0])
            return (
                <Reorder.Group onReorder={setState} values={state}>
                    <Reorder.Item value="a" />
                </Reorder.Group>
            )
        }
        const div = render(<Component />)

        expect(div).toBe(
            `<ul><li draggable="false" style="z-index:unset;transform:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;touch-action:pan-x"></li></ul>`
        )
    })

    test("Reorder: Doesn't render touch-scroll disabling styles if dragListener === false", () => {
        function Component() {
            const [state, setState] = useState([0])
            return (
                <Reorder.Group onReorder={setState} values={state}>
                    <Reorder.Item value="a" dragListener={false} />
                </Reorder.Group>
            )
        }
        const div = render(<Component />)

        expect(div).toBe(
            `<ul><li style="z-index:unset;transform:none"></li></ul>`
        )
    })

    test("Reorder: Renders provided element", () => {
        function Component() {
            const [state, setState] = useState([0])
            return (
                <Reorder.Group as="div" onReorder={setState} values={state}>
                    <Reorder.Item as="div" value="a" />
                </Reorder.Group>
            )
        }
        const div = render(<Component />)

        expect(div).toBe(
            `<div><div draggable="false" style="z-index:unset;transform:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;touch-action:pan-x"></div></div>`
        )
    })

    test("renders motion value child", () => {
        function Component() {
            const value = useMotionValue(5)

            return <motion.div>{value}</motion.div>
        }

        const string = render(<Component />)

        expect(string).toBe("<div>5</div>")
    })
}

describe("render", () => {
    runTests(renderToString)
})

describe("renderToStaticMarkup", () => {
    runTests(renderToStaticMarkup)
})
