import { motion } from "motion/react"

export const Board = ({ cards }: { cards: string[] }) => (
    <ul>
        {cards.map((card) => (
            <motion.li key={card} layout drag="x" dragSnapToOrigin>
                {card}
            </motion.li>
        ))}
    </ul>
)
