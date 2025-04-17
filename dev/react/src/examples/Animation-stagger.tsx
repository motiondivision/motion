import * as React from "react"
import { useState } from "react"
import { motion } from "framer-motion"

const sidebarStyle = {
    width: 100,
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    background: "white",
    listStyle: "none",
    padding: 40,
    margin: 0,
}

const itemStyle = {
    width: 100,
    height: 100,
    background: "red",
    padding: 0,
    margin: 0,
}

export const App = () => {
    const [isOpen, setIsOpen] = useState(true)
    const [items, setItems] = React.useState([0, 1, 2, 3, 4, 5])
    const sidebarPoses = {
        open: {
            x: 0,
            transition: {
                when: "beforeChildren",
                staggerChildren: 0.05,
                staggerDirection: -1,
            },
        },
        closed: {
            x: -180,
            transition: {
                when: "afterChildren",
                staggerChildren: 0.05,
            },
        },
    }

    const itemPoses = {
        open: {
            scale: 1,
            opacity: 1,
            transition: {
                scale: {
                    type: "spring",
                    stiffness: 400,
                    velocity: 40,
                    damping: 20,
                },
            },
        },
        closed: { scale: 0.5, opacity: 0.1, duration: 1 },
    }

    return (
        <motion.ul
            variants={sidebarPoses}
            initial="closed"
            animate={isOpen ? "open" : "closed"}
            style={sidebarStyle}
            onClick={() => setIsOpen(!isOpen)}
        >
            {shuffle(items).map((i) => {
                return (
                    <motion.li key={i} variants={itemPoses} style={itemStyle} />
                )
            })}
        </motion.ul>
    )
}
function shuffle(array: any[]) {
    let currentIndex = array.length,
        temporaryValue,
        randomIndex

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex)
        currentIndex -= 1

        // And swap it with the current element.
        temporaryValue = array[currentIndex]
        array[currentIndex] = array[randomIndex]
        array[randomIndex] = temporaryValue
    }

    return array
}
