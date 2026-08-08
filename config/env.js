const REMOTE_URL = 'https://paceron-backend-as9c.onrender.com/api/v1';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || REMOTE_URL;
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS === 'true';
