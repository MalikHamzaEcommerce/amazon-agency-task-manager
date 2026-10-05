/* Shared, dependency-free workflow logic. Used by the UI, Firebase adapter and tests. */
(function (root) {
  'use strict';
  const STATUSES = ['Not Started', 'In Progress', 'Awaiting', 'Blocked', 'Completed'];
  const RECURRENCES = ['Daily', 'Weekly', 'Monthly'];
  function normalizeStatus(value) {
    const s = String(value || '').trim();
    return ({ Complete: 'Completed', 'Not Start': 'Not Started', 'Waiting on Client': 'Awaiting' })[s] || s || 'Not Started';
  }
  function localDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    return localDate(new Date(value + 'T12:00:00')) === value;
  }
  function completedDate(task) {
    if (normalizeStatus(task?.status) !== 'Completed' || !task?.completed_at) return '';
    const value = task.completed_at;
    if (validDate(value)) return value;
    const date = typeof value?.toDate === 'function' ? value.toDate()
      : value?.seconds != null ? new Date(value.seconds * 1000) : new Date(value);
    // A UTC ISO string must be converted to the viewer's local day, not sliced.
    return localDate(date);
  }
  function dueDate(task) {
    return (normalizeStatus(task?.status) === 'Completed' && task?.completion_due_date)
      || task?.due_date || '';
  }
  function dateFor(task, basis = 'due') {
    return basis === 'completed' ? completedDate(task) : dueDate(task);
  }
  function nextDate(value, recurrence) {
    if (!validDate(value) || !RECURRENCES.includes(recurrence)) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (recurrence === 'Monthly') {
      const next = new Date(year, month, 1, 12);
      const end = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, end));
      return localDate(next);
    }
    const next = new Date(year, month - 1, day, 12);
    next.setDate(next.getDate() + (recurrence === 'Weekly' ? 7 : 1));
    return localDate(next);
  }
  function nextId(task, taskId) {
    // Retain the previous build's IDs so retry/repair finds existing occurrences.
    const series = String(task.series_id || taskId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    return `rec_${series}_${(Number(task.recurrence_index) || 0) + 1}`;
  }
  function completionPatch(previous, next, timestamp) {
    if (normalizeStatus(next.status) !== 'Completed') return { completed_at: null, completion_due_date: null };
    const wasCompleted = previous && normalizeStatus(previous.status) === 'Completed';
    return {
      // Repairing a legacy completed task must never invent a completion today.
      completed_at: wasCompleted ? (previous.completed_at || null) : timestamp,
      completion_due_date: (wasCompleted && previous.completion_due_date) || next.due_date || null
    };
  }
  function child(task, taskId, userId, timestamp) {
    if (normalizeStatus(task.status) !== 'Completed' || task.recurring !== true) return null;
    const nextDue = nextDate(dueDate(task), task.recurrence);
    if (!nextDue) throw new Error('Choose a valid due date and Daily, Weekly or Monthly recurrence before completing this task.');
    return {
      agency_id: task.agency_id,
      account_id: task.account_id || null,
      title: task.title || '',
      assigned_to: task.assigned_to || null,
      received_by: task.received_by || null,
      source: task.source || 'Internal',
      status: 'Not Started',
      priority: task.priority || 'Medium',
      due_date: nextDue,
      recurring: true,
      recurrence: task.recurrence,
      description: task.description || '',
      completed_at: null,
      completion_due_date: null,
      created_at: timestamp,
      created_by: userId,
      generated_by_recurrence: true,
      recurrence_parent_id: taskId,
      series_id: task.series_id || taskId,
      recurrence_index: (Number(task.recurrence_index) || 0) + 1
    };
  }
  const api = { STATUSES, RECURRENCES, normalizeStatus, localDate, validDate, completedDate, dueDate, dateFor, nextDate, nextId, completionPatch, child };
  root.TaskWorkflow = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
