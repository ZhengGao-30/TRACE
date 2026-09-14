import { useCallback, useEffect, useRef, useState } from 'react'
import { emptyPlayback, playbackTransition } from './ppePlayback'
import type { PlaybackArm, PlaybackEvent } from './ppePlayback'

export function usePPEPlayback(caseId: string, suspended = false) {
  const [state, setState] = useState(emptyPlayback)
  const stateRef = useRef(state)
  const generation = useRef(0)
  const dispatch = useCallback((event: PlaybackEvent) => {
    stateRef.current = playbackTransition(stateRef.current, event)
    setState(stateRef.current)
  }, [])
  const reset = useCallback(() => { generation.current++; dispatch({ type: 'reset' }) }, [dispatch])
  const play = useCallback((source: PlaybackArm, index: number) => {
    dispatch({ type: 'play', action: { caseId, source, index,
      token: `${caseId}:${source}:${index}:${++generation.current}`, status: 'restoring' } })
  }, [caseId, dispatch])
  const complete = useCallback((token: string) => dispatch({ type: 'complete', token }), [dispatch])
  useEffect(() => { reset(); return () => { generation.current++; stateRef.current = emptyPlayback() } }, [caseId, reset])
  useEffect(() => {
    const active = state.active
    if (!active || !['restoring', 'playing'].includes(active.status)) return
    if (suspended) { dispatch({ type: 'fail', token: active.token }); return }
    const timer = window.setTimeout(() => dispatch({ type: active.status === 'restoring' ? 'ready' : 'fail', token: active.token }),
      active.status === 'restoring' ? 220 : 75000)
    return () => window.clearTimeout(timer)
  }, [state.active?.token, state.active?.status, suspended, dispatch])
  return { ...state, play, complete, reset }
}
