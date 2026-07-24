import { useEffect, useState } from 'react'
import App from './App'
import Landing from './site/Landing'

/** Minimal hash router — deploys anywhere (GitHub Pages friendly), zero deps. */
function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#/, '') || '/')
  useEffect(() => {
    const on = () => setRoute(window.location.hash.replace(/^#/, '') || '/')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export function navigate(to: string) {
  window.location.hash = to
  window.scrollTo({ top: 0 })
}

export default function Router() {
  const route = useHashRoute()
  return route.startsWith('/demo') ? <App /> : <Landing />
}
