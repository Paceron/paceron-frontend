import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockListGroups,
  mockGetGroup,
  mockCreateGroup,
  mockUpdateGroup,
  mockDeleteGroup,
  mockGetGroupUsers,
  mockAddGroupUser,
  mockRemoveGroupUser,
} from './__mocks__/groups-mock.js';

// GET /api/v1/groups?team_id=&user_id= — requiere user_id para validar membresía.
export async function listGroups(teamId, userId) {
  if (USE_MOCKS) return await mockListGroups(teamId, userId);
  return await api.get(`/groups?team_id=${encodeURIComponent(teamId)}&user_id=${encodeURIComponent(userId)}`);
}

// GET /api/v1/groups/{id}.
export async function getGroup(groupId) {
  if (USE_MOCKS) return await mockGetGroup(groupId);
  return await api.get(`/groups/${groupId}`);
}

// POST /api/v1/groups — group.CreateGroupRequest.
export async function createGroup(payload) {
  if (USE_MOCKS) return await mockCreateGroup(payload);
  return await api.post('/groups', payload);
}

// PUT /api/v1/groups/{id} — group.UpdateGroupRequest (parcial).
export async function updateGroup(groupId, updates) {
  if (USE_MOCKS) return await mockUpdateGroup(groupId, updates);
  return await api.put(`/groups/${groupId}`, updates);
}

// DELETE /api/v1/groups/{id}.
export async function deleteGroup(groupId) {
  if (USE_MOCKS) return await mockDeleteGroup(groupId);
  return await api.delete(`/groups/${groupId}`);
}

// GET /api/v1/groups/{id}/users.
export async function getGroupUsers(groupId) {
  if (USE_MOCKS) return await mockGetGroupUsers(groupId);
  return await api.get(`/groups/${groupId}/users`);
}

// POST /api/v1/teams/{id}/groups/{group_id}/users — groupuser.AddGroupUserRequest.
export async function addGroupUser(teamId, groupId, userId) {
  if (USE_MOCKS) return await mockAddGroupUser(teamId, groupId, userId);
  return await api.post(`/teams/${teamId}/groups/${groupId}/users`, { user_id: userId });
}

// DELETE /api/v1/groups/{id}/users/{user_id}.
export async function removeGroupUser(groupId, userId) {
  if (USE_MOCKS) return await mockRemoveGroupUser(groupId, userId);
  return await api.delete(`/groups/${groupId}/users/${userId}`);
}
