/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PAYWALL?: string
  readonly VITE_CHECKOUT_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
