import { fireEvent } from "@testing-library/react"
import { motion } from "framer-motion"
import * as React from "react"
import { render } from "../../jest.setup"

describe("motion component rendering and styles", () => {
    it("renders", () => {
        const { container } = render(<motion.div />)
        expect(container.firstChild).toBeTruthy()
    })

    it("renders motion div component (using motion.create) without type errors ", () => {
        // onTap is a motion component specific prop
        const MotionDiv = motion.create("div")
        render(
            <MotionDiv
                id={"myCreatedMotionDiv"}
                onTap={() => {
                    console.log("Just tapping on div")
                }}
            />
        )
        expect(true).toBe(true)
    })

    it("renders HTML and SVG attributes without type errors", () => {
        const Component = () => {
            const ref = React.useRef<HTMLButtonElement | null>(null)
            return (
                <>
                    <motion.button title="test" type="button" />
                    <motion.button ref={ref} />
                    <motion.button
                        className="test"
                        animate={{ rotate: 90 }}
                        transition={{ velocity: 0 }}
                        style={{ overflow: "hidden" }}
                        onClick={(event) => event.stopPropagation()}
                    />
                    <motion.div
                        className="test"
                        animate={{ rotate: 90 }}
                        transition={{ velocity: 0 }}
                        style={{ overflow: "hidden" }}
                        onClick={(event) => event.stopPropagation()}
                    />
                    <motion.img
                        src="https://framer.com"
                        alt="alternative tag"
                    />
                    <motion.a href="https://framer.com" />
                    <motion.div role="progressbar" aria-valuemax={100} />
                </>
            )
        }
        const { container } = render(<Component />)
        expect(container.firstChild).toBeTruthy()
    })

    it("hydrates a provided ref by the time useLayoutEffect has fired", () => {
        let hasVanillaRef = false
        let hasMotionRef = false

        const Component = () => {
            const vanillaRef = React.useRef<HTMLDivElement>(null)
            const motionRef = React.useRef<HTMLDivElement>(null)

            React.useLayoutEffect(() => {
                if (vanillaRef.current !== null) hasVanillaRef = true
                if (motionRef.current !== null) hasMotionRef = true
            })

            return (
                <>
                    <div ref={vanillaRef} />
                    <motion.div ref={motionRef} />
                </>
            )
        }

        render(<Component />)
        expect(hasVanillaRef).toBe(true)
        expect(hasMotionRef).toBe(true)
    })

    it("renders child", () => {
        const { getByTestId } = render(
            <motion.div>
                <div data-testid="child" />
            </motion.div>
        )
        expect(getByTestId("child")).toBeTruthy()
    })

    it("renders normal event listeners", () => {
        const onPointerEnter = jest.fn()
        const onPointerLeave = jest.fn()
        const { container } = render(
            <motion.div
                onPointerEnter={() => onPointerEnter()}
                onPointerLeave={() => onPointerLeave()}
            />
        )

        fireEvent.pointerEnter(container.firstChild as Element)
        fireEvent.pointerLeave(container.firstChild as Element)

        expect(onPointerEnter).toBeCalled()
        expect(onPointerLeave).toBeCalled()
    })

    it("renders custom component", async () => {
        const Component = React.forwardRef(
            (_props, ref: React.RefObject<HTMLButtonElement>) => (
                <button type="submit" disabled ref={ref} />
            )
        )
        const MotionComponent = motion.create(Component)

        const promise = new Promise<Element>((resolve) => {
            const { rerender } = render(
                <MotionComponent ref={(ref) => resolve(ref as Element)} />
            )
            rerender(<Component />)
        })

        return expect(promise).resolves.toHaveAttribute("disabled")
    })

    it("accepts createref", async () => {
        const promise = new Promise<Element>((resolve) => {
            const ref = React.createRef<HTMLButtonElement>()
            const Component = () => {
                React.useEffect(() => {
                    resolve(ref.current as Element)
                })
                return <motion.button type="submit" ref={ref} />
            }
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toHaveAttribute("type", "submit")
    })

    // Note: Some part of the testing chain doesn't support setting transform-origin
    it("generates style attribute if passed a special transform style attr", () => {
        const { container } = render(
            <motion.div style={{ x: 10, background: "#fff" }} />
        )

        expect(container.firstChild).toHaveStyle(
            "transform: translateX(10px); background: #fff"
        )
        expect(container.firstChild).toHaveStyle("background: #fff")
    })

    it("generates style attribute if passed initial", () => {
        const { container } = render(
            <motion.div initial={{ x: 10, background: "#fff" }} />
        )
        expect(container.firstChild).toHaveStyle(
            "transform: translateX(10px); background: rgb(255, 255, 255)"
        )
    })

    it("generates style attribute if passed initial as variant label", () => {
        const variants = { foo: { x: 10, background: "#fff" } }
        const { container } = render(
            <motion.div initial="foo" variants={variants} />
        )
        expect(container.firstChild).toHaveStyle(
            "transform: translateX(10px); background: rgb(255, 255, 255)"
        )
    })

    it("generates style attribute if passed initial as false", () => {
        const { container } = render(
            <motion.div initial={false} animate={{ x: 100 }} />
        )
        expect(container.firstChild).toHaveStyle(
            "transform: translateX(100px);"
        )
    })

    // TODO: Replace dynamic variable test when we implement `custom` attribute: https://github.com/framer/company/issues/12508
    it("generates style attribute if passed initial as variant label is function", () => {
        const variants = { foo: (i: number) => ({ x: i * 10 }) }
        const childVariants = { foo: (i: number) => ({ x: i * 10 }) }

        const { getByTestId } = render(
            <motion.div initial="foo" custom={0} variants={variants}>
                <motion.div
                    variants={childVariants}
                    data-testid="a"
                    custom={0}
                />
                <motion.div
                    variants={childVariants}
                    data-testid="b"
                    custom={1}
                />
            </motion.div>
        )
        expect(getByTestId("a")).toHaveStyle("transform: none")
        expect(getByTestId("b")).toHaveStyle("transform: translateX(10px)")
    })

    it("generates style attribute for children if passed initial as variant label", () => {
        const variants = { foo: { x: 10, background: "#fff" } }
        const childVariants = { foo: { opacity: 0, color: "#f00" } }

        const { getByTestId } = render(
            <motion.div initial="foo" variants={variants}>
                <motion.div variants={childVariants} data-testid="child" />
            </motion.div>
        )
        expect(getByTestId("child")).toHaveStyle("opacity: 0; color: #f00")
    })

    it("generates style attribute for nested children if passed initial as variant label", () => {
        const variants = { foo: { x: 10, background: "#fff" } }
        const childVariants = { foo: { opacity: 0, color: "#f00" } }

        const { getByTestId } = render(
            <motion.div initial="foo" variants={variants}>
                <motion.div variants={childVariants} data-testid="child">
                    <motion.div
                        variants={childVariants}
                        data-testid="nestedchild"
                    />
                </motion.div>
            </motion.div>
        )
        expect(getByTestId("nestedchild")).toHaveStyle(
            "opacity: 0; color: #f00"
        )
    })

    it("doesnt propagate style for children if passed initial as object", () => {
        const { getByTestId } = render(
            <motion.ul
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <motion.li data-testid="child" />
            </motion.ul>
        )

        expect(getByTestId("child")).not.toHaveStyle(
            "opacity: 0; transform: translateY(50px)"
        )
    })

    it("renders styled component and overwrites style", () => {
        const { container } = render(
            <motion.div style={{ backgroundColor: "#f00" }} />
        )
        expect(container.firstChild).toHaveStyle("background-color: #f00")
    })

    it("renders transform", () => {
        const { container } = render(
            <motion.div style={{ transform: "translateX(10px)" }} />
        )
        expect(container.firstChild).toHaveStyle("transform: translateX(10px)")
    })

    it("filters MotionProps from the DOM", () => {
        const { container } = render(<motion.div initial={{ opacity: 0 }} />)
        expect(container.firstChild).not.toHaveAttribute("initial")
    })

    it("it can render inside <StrictMode />", () => {
        function Test() {
            return <motion.div animate={{ x: 100 }} initial={{ x: 0 }} />
        }

        const { container, rerender } = render(<Test />)

        rerender(<Test />)

        expect(container.firstChild).toBeTruthy()
    })

    it("it can render nested components inside <StrictMode />", () => {
        function Test() {
            return (
                <motion.div
                    animate="visible"
                    initial="parent"
                    variants={{
                        visible: { y: 0 },
                        hidden: { y: 5 },
                    }}
                >
                    <motion.span
                        initial="child"
                        variants={{
                            visible: { y: 0 },
                            hidden: { y: 5 },
                        }}
                    />
                </motion.div>
            )
        }

        const { container } = render(<Test />)
        expect(container.firstChild).toBeTruthy()
    })

    it("layout animations interrupt jump", async () => {
        const promise = new Promise((r)=>{
            const Component = ()=>{
                const [open,setOpen] = React.useState(false)
                const divRef = React.useRef<HTMLDivElement>(null)
                async function handleLayoutJump(){
                    setOpen(true)
                    await new Promise(resolve => setTimeout(resolve, 1500))
                    const firstSize = divRef.current?.getBoundingClientRect().width||0
                    setOpen(false)
                    const secondSize = divRef.current?.getBoundingClientRect().width||0
                    r(Math.abs(firstSize - secondSize))
                }
                React.useEffect(()=>{
                    handleLayoutJump()
                },[])
                return <motion.div layout="size">
                <motion.div
                    layout="size"
                    ref={divRef}
                    style={{ width:open? "200px" : "50px" }}
                    transition={{
                        layout: {
                            duration: 2,
                            ease: "linear",
                        },
                    }}
                />
            </motion.div>
            }
            render(<Component />)
        })

        expect(promise).resolves.toBeLessThan(50)
    })
})
