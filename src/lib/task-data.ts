type SubtaskState = { task_id: string; is_completed: boolean }

export function summarizeSubtasks(subtasks: SubtaskState[], taskId: string) {
  const matching = subtasks.filter((subtask) => subtask.task_id === taskId)
  return {
    completed: matching.filter((subtask) => subtask.is_completed).length,
    total: matching.length,
  }
}

export function createBoardDraft(name: string, description: string, color: string) {
  return { name: name.trim(), description: description.trim(), color }
}
