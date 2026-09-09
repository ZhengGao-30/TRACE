import { useEffect, useState } from 'react'
import App from './App'
import Landing from './site/Landing'
import AcrossDomains from './story/AcrossDomains'

/** Minimal hash router — deploys anywhere (GitHub Pages friendly), zero deps. */
function useHashRoute() {
  const [route, setRoute] = useState(() => ({ path: window.location.hash.replace(/^#/, '') || '/', revision: 0 }))
  useEffect(() => {
    // App's in-place case selection uses replaceState. Count actual navigation
    // events too, even when the next hash equals an earlier hook snapshot.
    const on = () => setRoute(previous => ({ path: window.location.hash.replace(/^#/, '') || '/', revision: previous.revision + 1 }))
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
  const { path: hash, revision } = useHashRoute()
  const route = hash.split('?')[0]
  if (route.startsWith('/across-domains')) return <AcrossDomains />
  return route.startsWith('/demo') ? <App key={`${revision}:${hash}`} /> : <Landing />
}
