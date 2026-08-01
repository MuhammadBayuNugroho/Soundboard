/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_GOOGLE_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Google API global types (loaded via script tag in index.html)
declare const gapi: typeof import('gapi')
declare const google: typeof import('@types/google.accounts')
