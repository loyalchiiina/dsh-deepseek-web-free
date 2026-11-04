import type { UserConfig } from 'tsdown'

export default {
  entry: {
    index: 'src/index.ts',
    invariant: 'src/invariant.ts',
    tui: 'src/tui.ts',
    bin: 'src/bin.ts',
  },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  deps: {
    neverBundle: [
      '@deepseek-ai/schemastery',
      '@deepseek-ai/cordis',
      '@deepseek-ai/dsh-commands',
      '@deepseek-ai/dsh-credentials',
      '@deepseek-ai/dsh-home-paths',
      '@deepseek-ai/dsh-host-webserver',
      '@deepseek-ai/dsh-invariants',
      '@deepseek-ai/dsh-llm',
      '@deepseek-ai/dsh-settings',
    ],
  },
} satisfies UserConfig
