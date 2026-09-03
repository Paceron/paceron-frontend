import { buildPhotoFormData } from '../utils/build-photo-form-data.js';

jest.mock('../utils/platform.js', () => ({ isWeb: false }));

// Mock FormData for native tests
class MockFormData {
  constructor() {
    this.fields = {};
  }

  append(key, value) {
    this.fields[key] = value;
  }

  get(key) {
    return this.fields[key] ?? null;
  }
}

global.FormData = MockFormData;

describe('buildPhotoFormData — nativo', () => {
  test('arma un FormData con el objeto {uri, name, type} tal cual, campo "photo" por default', async () => {
    const formData = await buildPhotoFormData('file:///tmp/foto.jpg', { mimeType: 'image/png' });
    const entry = formData.get('photo');
    expect(entry).toEqual({ uri: 'file:///tmp/foto.jpg', name: 'photo.jpg', type: 'image/png' });
  });

  test('usa image/jpeg por default si no se pasa mimeType', async () => {
    const formData = await buildPhotoFormData('file:///tmp/foto.jpg');
    expect(formData.get('photo').type).toBe('image/jpeg');
  });

  test('respeta un fieldName custom', async () => {
    const formData = await buildPhotoFormData('file:///tmp/foto.jpg', { fieldName: 'icon' });
    expect(formData.get('icon')).toBeTruthy();
    expect(formData.get('photo')).toBeNull();
  });
});

describe('buildPhotoFormData — web', () => {
  const mockBlob = { size: 123, type: 'image/jpeg' };

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../utils/platform.js', () => ({ isWeb: true }));
    global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(mockBlob) });
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('convierte el URI a Blob real antes de appendear', async () => {
    const { buildPhotoFormData: buildPhotoFormDataWeb } = require('../utils/build-photo-form-data.js');
    const formData = await buildPhotoFormDataWeb('blob:http://localhost/abc123');
    expect(global.fetch).toHaveBeenCalledWith('blob:http://localhost/abc123');
    expect(formData.get('photo')).toBe(mockBlob);
  });
});
