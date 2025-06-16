import { motion, useCycle } from "framer-motion"

const Child = () => {
    return (
        <motion.div
            animate
            layoutId="big"
            style={{
                overflow: "visible",
                position: "absolute",
                top: "137px",
                left: "26px",
                width: "120px",
                height: "120px",
                backgroundColor: "rgba(136, 85, 255, 0.3)",
                borderRadius: "20px",
            }}
        >
            <motion.div
                animate
                layoutId="small"
                style={{
                    width: "60px",
                    height: "60px",
                    overflow: "visible",
                    borderRadius: "10px",
                    position: "absolute",
                    backgroundColor: "#85f",
                    top: "30px",
                    left: "30px",
                }}
            />
        </motion.div>
    )
}

const Sibling = () => {
    return (
        <>
            <motion.div
                animate
                layoutId="big"
                style={{
                    overflow: "visible",
                    position: "absolute",
                    top: "110px",
                    left: "40px",
                    width: "60px",
                    height: "60px",
                    backgroundColor: "rgba(0, 153, 255, 0.3)",
                    borderRadius: "10px",
                }}
            />
            <motion.div
                animate
                layoutId="small"
                style={{
                    width: "60px",
                    height: "60px",
                    overflow: "visible",
                    borderRadius: "10px",
                    position: "absolute",
                    backgroundColor: "#0099ff",
                    top: "172px",
                    left: "102px",
                }}
            />
        </>
    )
}

export const App = () => {
    const [isOn, toggleOn] = useCycle(false, true)

    return (
        <div
            style={{
                width: "200px",
                height: "340px",
                overflow: "visible",
                backgroundColor: "#f3f3f3",
                borderRadius: "20px",
                position: "relative",
            }}
            onClick={() => toggleOn()}
        >
            {isOn ? <Child /> : <Sibling />}
        </div>
    )
}
