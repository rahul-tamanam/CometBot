/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SKIP_PASSWORD_AUTH?: string
  /** Backend API base URL (e.g. http://localhost:8000/api). Used for course catalog on onboarding. */
  readonly VITE_API_BASE?: string
  /** FastAPI transcript parser (base64 PDF). When unset, onboarding uses client-side pdf.js parsing. */
  readonly VITE_TRANSCRIPTPARSER_API?: string
}

declare module '*?url' {
  const src: string
  export default src
}
