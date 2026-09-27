import api from './api.js';

function buildHistoryParams(filters) {
  const params = new URLSearchParams();
  if (filters.teamId) params.set('team_id', filters.teamId);
  if (filters.groupId) params.set('group_id', filters.groupId);
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.exerciseId) params.set('exercise_id', filters.exerciseId);
  if (filters.setNumber) params.set('set_number', filters.setNumber);
  if (filters.athleteUserId) params.set('athlete_user_id', filters.athleteUserId);
  params.set('sort', filters.sort ?? 'feedback_date');
  params.set('order', filters.order ?? 'desc');
  params.set('page', String(filters.page ?? 1));
  params.set('page_size', String(filters.pageSize ?? 20));
  return params;
}

export async function getWorkoutFeedbackHistory(userId, filters) {
  return await api.get(`/users/${userId}/workout-feedback-history?${buildHistoryParams(filters).toString()}`);
}

export async function getAdministeredWorkoutFeedbackHistory(userId, filters) {
  return await api.get(`/users/${userId}/administered-workout-feedback-history?${buildHistoryParams(filters).toString()}`);
}

export async function deleteWorkoutFeedback(feedbackId) {
  return await api.delete(`/workout-feedback/${feedbackId}`);
}
