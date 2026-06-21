import { S } from '../../../shared/strings'

// Transient bar shown after a delete; the action commits the undo.
export default function UndoSnackbar({ pending, onUndo }) {
  if (!pending) return null
  const label = pending.count === 1 ? S.undo.deleted : S.undo.deletedN(pending.count)
  return (
    <div className="undo-snackbar">
      <span className="undo-snackbar-label">{label}</span>
      <button className="undo-snackbar-action" onClick={onUndo}>{S.undo.action}</button>
    </div>
  )
}
