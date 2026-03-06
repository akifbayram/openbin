"use client"

import { ChakraProvider, createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

const config = defineConfig({
  globalCss: {
    "html, body": {
      colorPalette: "purple",
    },
  },
  theme: {
    recipes: {
      button: {
        base: {
          borderRadius: "full",
        },
      },
    },
  },
})

const system = createSystem(defaultConfig, config)

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={system}>
      {children}
    </ChakraProvider>
  )
}
