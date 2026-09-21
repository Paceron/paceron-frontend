import { renderHook, act } from '@testing-library/react-native';

jest.mock('../services/trainingPlans.js', () => ({
  listTrainingPlans: jest.fn(),
  getTrainingPlan: jest.fn(),
  createTrainingPlan: jest.fn(),
  updateTrainingPlan: jest.fn(),
  deleteTrainingPlan: jest.fn(),
  cloneTrainingPlan: jest.fn(),
  listRunnerPlanAssignments: jest.fn(),
  assignPlanToRunner: jest.fn(),
  unassignPlanFromRunner: jest.fn(),
  listCurrentPlanMarks: jest.fn(),
  markPlanAsCurrent: jest.fn(),
  unmarkPlanAsCurrent: jest.fn(),
}));

import { useTrainingPlanForm } from '../hooks/use-training-plan-form.js';

test('validate rechaza un día presencial sin horario completo', () => {
  const { result } = renderHook(() => useTrainingPlanForm({ ownerId: 1 }));
  act(() => {
    result.current.setName('Plan test');
    result.current.updateDay(1, { kind: 'training', sessionId: '1', isPresencial: true, presencialTimeFrom: '', presencialTimeTo: '', presencialLocation: { lat: -34.6, lng: -58.4, label: 'Plaza' } });
  });
  let valid;
  act(() => { valid = result.current.validate(); });
  expect(valid).toBe(false);
  expect(result.current.errors.days).toMatch(/horario/i);
});

test('validate rechaza un día presencial con hora hasta anterior o igual a hora desde', () => {
  const { result } = renderHook(() => useTrainingPlanForm({ ownerId: 1 }));
  act(() => {
    result.current.setName('Plan test');
    result.current.updateDay(1, { kind: 'training', sessionId: '1', isPresencial: true, presencialTimeFrom: '09:00', presencialTimeTo: '08:00' });
  });
  let valid;
  act(() => { valid = result.current.validate(); });
  expect(valid).toBe(false);
});

test('validate rechaza un día presencial sin ubicación', () => {
  const { result } = renderHook(() => useTrainingPlanForm({ ownerId: 1 }));
  act(() => {
    result.current.setName('Plan test');
    result.current.updateDay(1, { kind: 'training', sessionId: '1', isPresencial: true, presencialTimeFrom: '08:00', presencialTimeTo: '09:00', presencialLocation: null });
  });
  let valid;
  act(() => { valid = result.current.validate(); });
  expect(valid).toBe(false);
  expect(result.current.errors.days).toMatch(/ubicación/i);
});

test('validate acepta un día presencial con horario y ubicación válidos', () => {
  const { result } = renderHook(() => useTrainingPlanForm({ ownerId: 1 }));
  act(() => {
    result.current.setName('Plan test');
    result.current.updateDay(1, { kind: 'training', sessionId: '1', isPresencial: true, presencialTimeFrom: '08:00', presencialTimeTo: '09:00', presencialLocation: { lat: -34.6, lng: -58.4, label: 'Plaza' } });
  });
  let valid;
  act(() => { valid = result.current.validate(); });
  expect(valid).toBe(true);
});

test('un día no presencial nunca dispara la validación de horario', () => {
  const { result } = renderHook(() => useTrainingPlanForm({ ownerId: 1 }));
  act(() => {
    result.current.setName('Plan test');
    result.current.updateDay(1, { kind: 'training', sessionId: '1', isPresencial: false, presencialTimeFrom: '', presencialTimeTo: '' });
  });
  let valid;
  act(() => { valid = result.current.validate(); });
  expect(valid).toBe(true);
});
