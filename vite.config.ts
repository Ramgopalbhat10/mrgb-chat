import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  plugins: [
    // devtools(), // Temporarily disabled due to port conflict
    nitro(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  ssr: {
    // Bundle lobehub packages and their emoji-mart dependencies for SSR
    // These packages use directory imports and JSON without import attributes
    // which don't work with Node's native ESM resolver
    noExternal: [/^@lobehub\//, /emoji-mart/],
  },
})

export default config
