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
        variants: {
          variant: {
            ghost: {
              color: "fg",
            },
          },
        },
      } as Record<string, unknown>,
      input: {
        base: {
          borderRadius: "var(--radius-md)",
        },
        variants: {
          variant: {
            subtle: {
              focusVisibleRing: "none",
            },
          },
        },
        defaultVariants: {
          variant: "subtle",
        },
      } as Record<string, unknown>,
    },
    slotRecipes: {
      dialog: {
        slots: ["trigger", "backdrop", "positioner", "content", "title", "description", "closeTrigger", "header", "body", "footer"],
        base: {
          content: {
            borderRadius: "var(--radius-xl)",
          },
          header: {
            flexDirection: "column",
          },
        },
        defaultVariants: {
          placement: "center",
        },
      },
      drawer: {
        slots: ["trigger", "backdrop", "positioner", "content", "title", "description", "closeTrigger", "header", "body", "footer"],
        base: {
          content: {
            borderRadius: "var(--radius-xl)",
          },
          header: {
            flexDirection: "column",
          },
          footer: {
            flexDirection: "column",
          },
        },
      },
    // biome-ignore lint/suspicious/noExplicitAny: Chakra v3 types require full SlotRecipeDefinition but createSystem deep-merges partial overrides
    } as any,
  },
})

const system = createSystem(defaultConfig, config)

/** Responsive drawer placement: bottom sheet on mobile, side drawer on desktop */
export const DRAWER_PLACEMENT = { mdDown: "bottom", md: "end" } as const

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={system}>
      {children}
    </ChakraProvider>
  )
}
