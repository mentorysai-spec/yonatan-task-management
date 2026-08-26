import { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { createTaskDraft, moveTask, updateTaskDraft, type TaskStatus } from './lib/task-rules'

type Task = {
  id: string
  title: string
  description: string
  status: TaskStatus
  position: number
}

const columns: Array<{ id: TaskStatus; label: string; hint: string }> = [
  { id: 'todo', label: 'לביצוע', hint: 'הדברים הבאים' },
  { id: 'in_progress', label: 'בתהליך', hint: 'מה שקורה עכשיו' },
  { id: 'done', label: 'הושלם', hint: 'כל הכבוד' },
]

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadTasks() {
    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('tasks')
      .select('id,title,description,status,position')
      .order('status')
      .order('position')
    if (queryError) setError(queryError.message)
    else setTasks((data ?? []) as Task[])
    setLoading(false)
  }

  useEffect(() => { void loadTasks() }, [])

  const grouped = useMemo(() => Object.fromEntries(columns.map((column) => [
    column.id,
    tasks.filter((task) => task.status === column.id),
  ])) as Record<TaskStatus, Task[]>, [tasks])

  async function addTask(event: FormEvent) {
    event.preventDefault()
    const draft = editing ? updateTaskDraft(title, description) : createTaskDraft(title, description)
    if (!draft.title) return
    setSaving(true)
    setError('')
    const request = editing
      ? supabase.from('tasks').update(draft).eq('id', editing.id)
      : supabase.from('tasks').insert({ ...draft, position: grouped.todo.length })
    const { error: saveError } = await request
    if (saveError) setError(saveError.message)
    else {
      setTitle('')
      setDescription('')
      setEditing(null)
      await loadTasks()
    }
    setSaving(false)
  }

  async function changeStatus(task: Task, status: TaskStatus) {
    const nextTask = moveTask(task, status)
    setError('')
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ status: nextTask.status, position: grouped[status].length })
      .eq('id', task.id)
    if (updateError) setError(updateError.message)
    else await loadTasks()
  }

  async function deleteTask(id: string) {
    if (!window.confirm('למחוק את המשימה?')) return
    setError('')
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else await loadTasks()
  }

  function startEditing(task: Task) {
    setEditing(task)
    setTitle(task.title)
    setDescription(task.description)
  }

  function cancelEditing() {
    setEditing(null)
    setTitle('')
    setDescription('')
  }

  return <main className="app-shell">
    <header className="hero">
      <div>
        <p className="eyebrow">KANBAN אישי</p>
        <h1>יונתן ניהול משימות</h1>
        <p className="subtitle">מקום אחד ברור לכל מה שחשוב לך.</p>
      </div>
      <span className="public-badge">לוח ציבורי</span>
    </header>

    <section className="composer" aria-label="הוספת משימה">
      <form onSubmit={addTask}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="מה המשימה הבאה?" aria-label="כותרת משימה" required />
        <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} placeholder="פירוט קצר (אופציונלי)" aria-label="תיאור משימה" />
        <button type="submit" disabled={saving}>{saving ? 'שומר...' : editing ? 'שמירת שינויים' : 'הוספת משימה'}</button>
        {editing && <button className="cancel" type="button" onClick={cancelEditing}>ביטול</button>}
      </form>
    </section>

    {error && <p className="error" role="alert">שגיאה: {error}</p>}
    {loading ? <p className="loading">טוען משימות...</p> : <section className="board" aria-label="לוח משימות">
      {columns.map((column) => <section className="column" key={column.id} aria-labelledby={`${column.id}-title`}>
        <header className="column-head">
          <div><h2 id={`${column.id}-title`}>{column.label}</h2><span>{column.hint}</span></div>
          <b>{grouped[column.id].length}</b>
        </header>
        <div className="task-list">
          {grouped[column.id].map((task) => <article className="task-card" key={task.id}>
            <h3>{task.title}</h3>
            {task.description && <p>{task.description}</p>}
            <footer>
              <div className="move-actions">
                {columns.filter((candidate) => candidate.id !== task.status).map((candidate) => <button className="move" key={candidate.id} onClick={() => void changeStatus(task, candidate.id)}>העבר ל{candidate.label}</button>)}
              </div>
              <div className="card-actions"><button className="edit" onClick={() => startEditing(task)}>עריכה</button><button className="delete" onClick={() => void deleteTask(task.id)} aria-label={`מחיקת ${task.title}`}>מחיקה</button></div>
            </footer>
          </article>)}
          {grouped[column.id].length === 0 && <p className="empty">אין כאן משימות עדיין</p>}
        </div>
      </section>)}
    </section>}
  </main>
}
