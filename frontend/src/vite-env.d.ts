/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SKIP_PASSWORD_AUTH?: string
  /** FastAPI transcript parser (base64 PDF). When unset, onboarding uses client-side pdf.js parsing. */
  readonly VITE_TRANSCRIPTPARSER_API?: string
}

declare module '*?url' {
  const src: string
  export default src
}
