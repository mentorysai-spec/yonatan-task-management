import { describe, expect, it } from 'vitest'
import { summarizeSubtasks } from './task-data'

describe('summarizeSubtasks', () => {
  it('reports completed items out of all task subtasks', () => {
    expect(summarizeSubtasks([
      { task_id: 'task-1', is_completed: true },
      { task_id: 'task-1', is_completed: false },
      { task_id: 'task-2', is_completed: true },
    ], 'task-1')).toEqual({ completed: 1, total: 2 })
  })
})
