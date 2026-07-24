import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Premium type (Inter is banned by the taste skill). Geist for UI + mono,
// Plus Jakarta for the display title; CJK falls back to system PingFang / YaHei.
import '@fontsource/geist-sans/400.css'
import '@fontsource/geist-sans/500.css'
import '@fontsource/geist-sans/600.css'
import '@fontsource/geist-sans/700.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import Router from './Router'
import { I18nProvider } from './i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <Router />
    </I18nProvider>
  </StrictMode>,
)
