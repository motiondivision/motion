
<
## ✨ import React from "react"; import { motion } from "framer-motion"; import { Card, CardContent } from "@/components/ui/card"; import { Button } from "@/components/ui/button"; import { ShoppingCart, Star } from "lucide-react";

export default function SaikouNoSite() { return ( <div className="min-h-screen bg-black text-white"> {/* Hero Section */} <section className="relative flex flex-col items-center justify-center text-center py-24 px-6 bg-gradient-to-b from-black via-zinc-900 to-black"> <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-5xl md:text-7xl font-bold tracking-widest text-red-600" > SAIKOU NO </motion.h1> <p className="mt-6 text-lg md:text-xl text-zinc-300 max-w-2xl"> Experimente o melhor da culinária japonesa com sabor autêntico, frescor incomparável e uma experiência única. </p> <Button className="mt-8 bg-red-600 hover:bg-red-700 text-white rounded-2xl px-8 py-6 text-lg shadow-lg"> Ver Cardápio </Button> </section>

{/* Sobre */}
  <section className="py-20 px-6 bg-zinc-950 text-center">
    <h2 className="text-3xl md:text-4xl font-semibold mb-6">Sobre Nós</h2>
    <p className="text-zinc-400 max-w-3xl mx-auto">
      No SAIKOU NO, cada prato é preparado com ingredientes selecionados e técnicas tradicionais japonesas. Nosso objetivo é proporcionar uma explosão de sabores a cada mordida.
    </p>
  </section>

  {/* Cardápio */}
  <section className="py-20 px-6 bg-black">
    <h2 className="text-3xl md:text-4xl font-semibold text-center mb-12">Destaques do Cardápio</h2>
    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
      {["Combo Sushi Especial", "Temaki Salmão Premium", "Hot Roll Crocante"].map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.2 }}
          viewport={{ once: true }}
        >
          <Card className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">{item}</h3>
                <Star className="text-red-500" />
              </div>
              <p className="text-zinc-400 mb-6">
                Preparado com ingredientes frescos e selecionados para oferecer o melhor sabor.
              </p>
              <Button className="w-full bg-red-600 hover:bg-red-700 rounded-2xl">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Pedir Agora
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  </section>

  {/* Contato */}
  <section className="py-20 px-6 bg-zinc-950 text-center">
    <h2 className="text-3xl md:text-4xl font-semibold mb-6">Contato</h2>
    <p className="text-zinc-400">📍 Rua Exemplo, 123 - São Paulo, SP</p>
    <p className="text-zinc-400">📞 (11) 99999-9999</p>
    <p className="text-zinc-400">🕒 Terça a Domingo - 18h às 23h</p>
    <Button className="mt-8 bg-red-600 hover:bg-red-700 rounded-2xl px-8 py-6 text-lg">
      Reservar Mesa
    </Button>
  </section>

  {/* Footer */}
  <footer className="bg-black border-t border-zinc-800 py-6 text-center text-zinc-500">
    © {new Date().getFullYear()} SAIKOU NO - Todos os direitos reservados.
  </footer>
</div>

); }

Motion is sustainable thanks to the kind support of its sponsors.

[Become a sponsor](https://motion.dev/sponsor)

### Partners

Motion powers the animations for all websites built with Framer, the web builder for creative pros. The Motion website itself is built on Framer, for its delightful canvas-based editing and powerful CMS features.

<a href="https://framer.link/FlnUbQY">
  <img alt="Framer" src="https://github.com/user-attachments/assets/22a79be7-672e-4336-bfb7-5d55d1deb917" width="250px" height="150px">
</a>

Motion drives the animations on the Cursor homepage, and is working with Cursor to bring powerful AI workflows to the Motion examples and docs.

<a href="https://cursor.com">
  <img alt="Cursor" src="https://github.com/user-attachments/assets/81c482d3-c2c2-4b35-bbcf-933b28d5b448" width="250px" height="150px" />
</a>

### Platinum

<a href="https://linear.app"><img alt="Linear" src="https://github.com/user-attachments/assets/f9ce44b4-af28-4770-bb6e-9515b474bfb2" width="250px" height="150px"></a> <a href="https://figma.com"><img alt="Figma" src="https://github.com/user-attachments/assets/1077d0ab-4305-4a1f-81c8-d5be8c4c6717" width="250px" height="150px"></a> <a href="https://sanity.io"><img alt="Sanity" src="https://github.com/user-attachments/assets/80134088-f456-483f-8edd-940593c120ce" width="250px" height="150px"></a> <a href="https://animations.dev"><img alt="Sanity" src="https://github.com/user-attachments/assets/7c5ab87d-c7d9-44b4-9c7e-f9e6a9f3ba3b" width="250px" height="150px"></a> <a href="https://clerk.com?utm_campaign=motion"><img alt="Clerk" src="https://github.com/user-attachments/assets/16789f85-eaf4-46fb-9961-b3e66d33afbc" width="250px" height="150px"></a>


### Gold

<a href="https://liveblocks.io"><img alt="Liveblocks" src="https://github.com/user-attachments/assets/28eddbe5-1617-4e74-969d-2eb6fcd481af" width="200px" height="120px"></a> <a href="https://lu.ma"><img alt="Luma" src="https://github.com/user-attachments/assets/ac282433-6adb-4ad2-9fd2-5c6ee513c14b" width="200px" height="120px"></a> <a href="https://lottiefiles.com"><img alt="LottieFiles" src="https://github.com/user-attachments/assets/4e99d8c7-4cba-43ee-93c5-93861ae708ec" width="200px" height="120px"></a>

### Silver

<a href="https://www.frontend.fyi/?utm_source=motion"><img alt="Frontend.fyi" src="https://github.com/user-attachments/assets/f16e3eb9-f0bd-4ad1-8049-f079a3d65c69" width="150px" height="100px"></a> <a href="https://firecrawl.dev"><img alt="Firecrawl" src="https://github.com/user-attachments/assets/2c44e7f4-5c2a-4714-9050-1570538665ff" width="150px" height="100px"></a> <a href="https://puzzmo.com"><img alt="Puzzmo" src="https://github.com/user-attachments/assets/e32205a7-3ab1-41ec-8729-a794058fd655" width="150px" height="100px"></a> <a href="https://bolt.new"><img alt="Bolt.new" src="https://github.com/user-attachments/assets/7932d4b2-bb6c-422e-82b9-6ad78a7e3090" width="150px" height="100px"></a>

### Personal sponsors

-   [OlegWock](https://sinja.io)
-   [Lambert Weller](https://github.com/l-mbert)
-   [Jake LeBoeuf](https://jklb.wf)
-   [Han Lee](https://github.com/hahnlee)
