/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PAYWALL?: string
  readonly VITE_CHECKOUT_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_KEY?: string
  readonly VITE_PIX_KEY?: string
  readonly VITE_PIX_NAME?: string
  readonly VITE_PIX_CITY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
