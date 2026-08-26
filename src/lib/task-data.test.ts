import { describe, expect, it } from 'vitest'
import { createBoardDraft, summarizeSubtasks } from './task-data'

describe('summarizeSubtasks', () => {
  it('reports completed items out of all task subtasks', () => {
    expect(summarizeSubtasks([
      { task_id: 'task-1', is_completed: true },
      { task_id: 'task-1', is_completed: false },
      { task_id: 'task-2', is_completed: true },
    ], 'task-1')).toEqual({ completed: 1, total: 2 })
  })

  it('creates a trimmed board draft with its selected color', () => {
    expect(createBoardDraft('  פרויקט חדש  ', '  רעיון להתנסות  ', '#22c55e')).toEqual({
      name: 'פרויקט חדש',
      description: 'רעיון להתנסות',
      color: '#22c55e',
    })
  })
})
