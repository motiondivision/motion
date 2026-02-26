import { motion, LayoutGroup } from "framer-motion"
import * as React from "react"
import { useState } from "react"

const style = {
    width: 100,
    height: 100,
    opacity: 1,
    borderRadius: 20,
    margin: 20,
}

const Item = ({
    id,
    backgroundColor,
}: {
    id: string
    backgroundColor: string
}) => {
    const [visible, setVisible] = useState(true)
    const isVisible = () => !!visible
    return (
        <LayoutGroup id="group-2">
            <motion.div style={{ display: "contents" }}>
                {isVisible() && (
                    <motion.div
                        id={id}
                        layoutId={id}
                        style={{ ...style, backgroundColor }}
                        onClick={() => setVisible(false)}
                        transition={{ duration: 10, ease: () => 0.5 }}
                    />
                )}
            </motion.div>
        </LayoutGroup>
    )
}

const containerStyle: React.CSSProperties = {
    display: "block",
    width: "min-content",
    height: "min-content",
}

const stackStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "center",
    padding: 20,
    width: "auto",
    height: "auto",

    backgroundColor: "blue",
}

const List: React.FunctionComponent<React.PropsWithChildren> = (props) => {
    return (
        <LayoutGroup id="list">
            <motion.div style={{ display: "contents" }}>
                <motion.div
                    id="stack"
                    layoutId="stack"
                    style={{ containerStyle }}
                    transition={{ duration: 0.2, ease: () => 0.5 }}
                >
                    <motion.div style={stackStyle}>
                        <motion.div style={{ display: "contents" }}>
                            {props.children}
                        </motion.div>
                    </motion.div>
                </motion.div>
            </motion.div>
        </LayoutGroup>
    )
}

export const App = () => {
    return (
        <LayoutGroup id="group-1">
            <motion.div
                style={{ position: "absolute", left: 100, bottom: 100 }}
            >
                <List>
                    <Item id="a" backgroundColor="red" />
                    <Item id="b" backgroundColor="yellow" />
                </List>
            </motion.div>
        </LayoutGroup>
    )
}
