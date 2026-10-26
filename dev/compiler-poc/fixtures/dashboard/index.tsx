import { Button } from "./Button"
import { Features } from "./Features"
import { Hero } from "./Hero"
import { Modal } from "./Modal"
import { Board } from "./Board"

export const App = () => (
    <main>
        <Hero />
        <Features items={["a", "b"]} />
        <Button>Go</Button>
        <Modal isOpen />
        <Board cards={["a"]} />
    </main>
)
