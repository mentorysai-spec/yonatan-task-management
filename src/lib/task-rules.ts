export type TaskStatus = 'todo' | 'in_progress' | 'done'

export type TaskDraft = {
  title: string
  description: string
  status: TaskStatus
}

export function createTaskDraft(title: string, description: string): TaskDraft {
  return {
    title: title.trim(),
    description: description.trim(),
    status: 'todo',
  }
}

export function updateTaskDraft(title: string, description: string): Pick<TaskDraft, 'title' | 'description'> {
  return { title: title.trim(), description: description.trim() }
}

export function moveTask<T extends { status: TaskStatus }>(task: T, status: TaskStatus): T {
  return { ...task, status }
}
