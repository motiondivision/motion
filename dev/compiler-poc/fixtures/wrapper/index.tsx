import { Button } from "./Button"
import { Features } from "./Features"
import { Hero } from "./Hero"
import { Modal } from "./Modal"
import { Box } from "./Box"

export const App = () => (
    <main>
        <Hero />
        <Features items={["a", "b"]} />
        <Button>Go</Button>
        <Modal isOpen />
        <Box animate={{ x: 10 }} />
    </main>
)
