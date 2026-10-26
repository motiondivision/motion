import { Button } from "./Button"
import { Features } from "./Features"
import { Hero } from "./Hero"
import { Modal } from "./Modal"

export const App = () => (
    <main>
        <Hero />
        <Features items={["a", "b"]} />
        <Button>Go</Button>
        <Modal isOpen />
    </main>
)
