import { describe, expect, it } from 'vitest'
import { createTaskDraft, moveTask, updateTaskDraft } from './task-rules'

describe('task rules', () => {
  it('creates a trimmed task in the todo column', () => {
    expect(createTaskDraft('  לסיים את הלוח  ', '  היום  ')).toEqual({
      title: 'לסיים את הלוח',
      description: 'היום',
      status: 'todo',
    })
  })

  it('moves a task to a selected Kanban column', () => {
    expect(moveTask({ id: '1', status: 'todo' }, 'done')).toEqual({ id: '1', status: 'done' })
  })

  it('updates a task draft with trimmed values', () => {
    expect(updateTaskDraft('  לעדכן משימה ', ' פירוט חדש ')).toEqual({
      title: 'לעדכן משימה',
      description: 'פירוט חדש',
    })
  })
})
