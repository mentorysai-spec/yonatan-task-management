import { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { createTaskDraft, moveTask, updateTaskDraft, type TaskStatus } from './lib/task-rules'
import { createBoardDraft, filterByBoard, summarizeSubtasks } from './lib/task-data'

type Task = {
  id: string
  title: string
  description: string
  status: TaskStatus
  position: number
  board_id: string | null
  project_id: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null
  estimated_minutes: number | null
}

type Board = { id: string; name: string; description: string; color: string }
type Project = { id: string; board_id: string; name: string; status: 'active' | 'on_hold' | 'completed' }
type Label = { id: string; board_id: string; name: string; color: string }
type TaskLabel = { task_id: string; label_id: string }
type Subtask = { id: string; task_id: string; title: string; is_completed: boolean }
type Comment = { id: string; task_id: string; author_name: string; body: string }
type Activity = { id: string; task_id: string; action: string; details: string }

const columns: Array<{ id: TaskStatus; label: string; hint: string }> = [
  { id: 'todo', label: 'לביצוע', hint: 'הדברים הבאים' },
  { id: 'in_progress', label: 'בתהליך', hint: 'מה שקורה עכשיו' },
  { id: 'done', label: 'הושלם', hint: 'כל הכבוד' },
]

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [boards, setBoards] = useState<Board[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [taskLabels, setTaskLabels] = useState<TaskLabel[]>([])
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [showBoardForm, setShowBoardForm] = useState(false)
  const [boardName, setBoardName] = useState('')
  const [boardDescription, setBoardDescription] = useState('')
  const [boardColor, setBoardColor] = useState('#5d55d7')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadTasks() {
    setLoading(true)
    const [taskResult, boardResult, projectResult, labelResult, taskLabelResult, subtaskResult, commentResult, activityResult] = await Promise.all([
      supabase.from('tasks').select('id,title,description,status,position,board_id,project_id,priority,due_date,estimated_minutes').order('status').order('position'),
      supabase.from('boards').select('id,name,description,color'),
      supabase.from('projects').select('id,board_id,name,status'),
      supabase.from('labels').select('id,board_id,name,color'),
      supabase.from('task_labels').select('task_id,label_id'),
      supabase.from('subtasks').select('id,task_id,title,is_completed').order('position'),
      supabase.from('task_comments').select('id,task_id,author_name,body'),
      supabase.from('task_activity').select('id,task_id,action,details'),
    ])
    const queryError = [taskResult, boardResult, projectResult, labelResult, taskLabelResult, subtaskResult, commentResult, activityResult].find((result) => result.error)?.error
    if (queryError) setError(queryError.message)
    else {
      setTasks((taskResult.data ?? []) as Task[])
      const loadedBoards = (boardResult.data ?? []) as Board[]
      setBoards(loadedBoards)
      setSelectedBoardId((current) => current || loadedBoards[0]?.id || '')
      setProjects((projectResult.data ?? []) as Project[])
      setLabels((labelResult.data ?? []) as Label[])
      setTaskLabels((taskLabelResult.data ?? []) as TaskLabel[])
      setSubtasks((subtaskResult.data ?? []) as Subtask[])
      setComments((commentResult.data ?? []) as Comment[])
      setActivities((activityResult.data ?? []) as Activity[])
    }
    setLoading(false)
  }

  useEffect(() => { void loadTasks() }, [])

  const visibleTasks = useMemo(() => filterByBoard(tasks, selectedBoardId), [tasks, selectedBoardId])
  const visibleProjects = useMemo(() => filterByBoard(projects, selectedBoardId), [projects, selectedBoardId])
  const visibleLabels = useMemo(() => filterByBoard(labels, selectedBoardId), [labels, selectedBoardId])
  const grouped = useMemo(() => Object.fromEntries(columns.map((column) => [
    column.id,
    visibleTasks.filter((task) => task.status === column.id),
  ])) as Record<TaskStatus, Task[]>, [visibleTasks])
  const projectById = useMemo(() => new Map(visibleProjects.map((project) => [project.id, project])), [visibleProjects])
  const labelsForTask = (taskId: string) => taskLabels
    .filter((mapping) => mapping.task_id === taskId)
    .map((mapping) => visibleLabels.find((label) => label.id === mapping.label_id))
    .filter((label): label is Label => Boolean(label))

  async function addTask(event: FormEvent) {
    event.preventDefault()
    const draft = editing ? updateTaskDraft(title, description) : createTaskDraft(title, description)
    if (!draft.title) return
    setSaving(true)
    setError('')
    const request = editing
      ? supabase.from('tasks').update(draft).eq('id', editing.id)
      : supabase.from('tasks').insert({ ...draft, board_id: selectedBoardId || null, position: grouped.todo.length })
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

  async function addBoard(event: FormEvent) {
    event.preventDefault()
    const draft = createBoardDraft(boardName, boardDescription, boardColor)
    if (!draft.name) return
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('boards').insert(draft)
    if (insertError) setError(insertError.message)
    else {
      setBoardName('')
      setBoardDescription('')
      setBoardColor('#5d55d7')
      setShowBoardForm(false)
      await loadTasks()
    }
    setSaving(false)
  }

  return <main className="app-shell">
    <header className="hero">
      <div>
        <p className="eyebrow">KANBAN אישי</p>
        <h1>יונתן ניהול משימות</h1>
        <p className="subtitle">מקום אחד ברור לכל מה שחשוב לך.</p>
      </div>
      <div className="board-switcher"><label htmlFor="board-select">לוח פעיל</label><select id="board-select" value={selectedBoardId} onChange={(event) => setSelectedBoardId(event.target.value)}>{boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}</select></div>
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
          {grouped[column.id].map((task) => {
            const progress = summarizeSubtasks(subtasks, task.id)
            const project = task.project_id ? projectById.get(task.project_id) : undefined
            return <article className="task-card" key={task.id}>
            <h3>{task.title}</h3>
            {task.description && <p>{task.description}</p>}
            <div className="metadata">
              <span className={`priority ${task.priority}`}>{task.priority === 'urgent' ? 'דחוף' : task.priority === 'high' ? 'גבוהה' : task.priority === 'medium' ? 'רגילה' : 'נמוכה'}</span>
              {project && <span>פרויקט: {project.name}</span>}
              {task.due_date && <span>יעד: {new Date(task.due_date).toLocaleDateString('he-IL')}</span>}
              {task.estimated_minutes && <span>{task.estimated_minutes} דק׳</span>}
            </div>
            {labelsForTask(task.id).length > 0 && <div className="labels">{labelsForTask(task.id).map((label) => <span key={label.id} style={{ backgroundColor: label.color }}>{label.name}</span>)}</div>}
            {(progress.total > 0 || comments.some((comment) => comment.task_id === task.id) || activities.some((activity) => activity.task_id === task.id)) && <div className="relations"><span>✓ {progress.completed}/{progress.total} תתי־משימות</span><span>💬 {comments.filter((comment) => comment.task_id === task.id).length}</span><span>◷ {activities.filter((activity) => activity.task_id === task.id).length}</span></div>}
            <footer>
              <div className="move-actions">
                {columns.filter((candidate) => candidate.id !== task.status).map((candidate) => <button className="move" key={candidate.id} onClick={() => void changeStatus(task, candidate.id)}>העבר ל{candidate.label}</button>)}
              </div>
              <div className="card-actions"><button className="edit" onClick={() => startEditing(task)}>עריכה</button><button className="delete" onClick={() => void deleteTask(task.id)} aria-label={`מחיקת ${task.title}`}>מחיקה</button></div>
            </footer>
          </article>})}
          {grouped[column.id].length === 0 && <p className="empty">אין כאן משימות עדיין</p>}
        </div>
      </section>)}
    </section>}

    <section className="data-explorer" aria-labelledby="data-title">
      <div className="explorer-head"><div><p className="eyebrow">SUPABASE EXPLORER</p><h2 id="data-title">כך הנתונים מחוברים</h2><p>המידע שמופיע כאן נטען מהטבלאות ב‑Supabase בזמן אמת.</p></div><button className="new-board" type="button" onClick={() => setShowBoardForm((visible) => !visible)}>{showBoardForm ? 'סגירה' : '+ לוח חדש'}</button></div>
      {showBoardForm && <form className="board-form" onSubmit={addBoard}>
        <input value={boardName} onChange={(event) => setBoardName(event.target.value)} maxLength={80} placeholder="שם הלוח החדש" aria-label="שם הלוח החדש" required />
        <input value={boardDescription} onChange={(event) => setBoardDescription(event.target.value)} maxLength={500} placeholder="תיאור קצר (אופציונלי)" aria-label="תיאור הלוח" />
        <label className="color-picker">צבע <input type="color" value={boardColor} onChange={(event) => setBoardColor(event.target.value)} aria-label="צבע הלוח" /></label>
        <button type="submit" disabled={saving}>{saving ? 'שומר...' : 'יצירת לוח'}</button>
      </form>}
      <div className="data-grid">
        <article><h3>לוח פעיל</h3><b>1</b>{boards.filter((board) => board.id === selectedBoardId).map((board) => <p key={board.id}><i style={{ background: board.color }} />{board.name}</p>)}</article>
        <article><h3>פרויקטים</h3><b>{visibleProjects.length}</b>{visibleProjects.map((project) => <p key={project.id}>{project.name} <small>{project.status}</small></p>)}</article>
        <article><h3>תגיות</h3><b>{visibleLabels.length}</b><div className="labels">{visibleLabels.map((label) => <span key={label.id} style={{ backgroundColor: label.color }}>{label.name}</span>)}</div></article>
        <article><h3>פירוט קשרים</h3><b>{subtasks.filter((item) => visibleTasks.some((task) => task.id === item.task_id)).length + comments.filter((item) => visibleTasks.some((task) => task.id === item.task_id)).length + activities.filter((item) => visibleTasks.some((task) => task.id === item.task_id)).length}</b><p>{subtasks.filter((item) => visibleTasks.some((task) => task.id === item.task_id)).length} תתי־משימות · {comments.filter((item) => visibleTasks.some((task) => task.id === item.task_id)).length} תגובות · {activities.filter((item) => visibleTasks.some((task) => task.id === item.task_id)).length} פעולות</p></article>
      </div>
    </section>
  </main>
}
