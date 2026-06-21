import { useEffect, useRef, useState } from 'react'

// How long a deleted item can be restored before the delete is committed.
const UNDO_WINDOW_MS = 5000

// Deferred delete with an undo window, mirroring the mobile CollectionProvider.
// The caller removes items from its own UI immediately, then calls schedule()
// with a commit (do the real DB + storage delete) and restore (put the items
// back in the UI) callback. A second schedule() flushes the prior one.
export function useUndoableDelete() {
  const [pending, setPending] = useState(null) // { count } | null
  const ref = useRef(null) // { timer, commit, restore }

  function schedule({ count, commit, restore }) {
    const prev = ref.current
    if (prev) { clearTimeout(prev.timer); prev.commit() }
    const timer = setTimeout(() => {
      const cur = ref.current
      ref.current = null
      setPending(null)
      cur?.commit()
    }, UNDO_WINDOW_MS)
    ref.current = { timer, commit, restore }
    setPending({ count })
  }

  function undo() {
    const cur = ref.current
    if (!cur) return
    clearTimeout(cur.timer)
    ref.current = null
    setPending(null)
    cur.restore()
  }

  // Commit a held delete if the page unmounts before the window elapses.
  useEffect(() => () => {
    const cur = ref.current
    if (cur) { clearTimeout(cur.timer); cur.commit() }
  }, [])

  return { pending, schedule, undo }
}
