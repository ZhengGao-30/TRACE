import { useEffect, useState } from 'react'
import App from './App'
import Landing from './site/Landing'
import AttackStory from './story/AttackStory'
import ComparePage from './story/ComparePage'
import Reel from './story/Reel'
import AcrossDomains from './story/AcrossDomains'

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
  if (route.startsWith('/across-domains')) return <AcrossDomains />
  if (route.startsWith('/threat')) return <Reel />
  if (route.startsWith('/compare')) return <ComparePage />
  if (route.startsWith('/attack')) return <AttackStory />
  return route.startsWith('/demo') ? <App /> : <Landing />
}
