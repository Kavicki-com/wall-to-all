import { device, element, by, waitFor } from 'detox';

beforeAll(async () => {
  await device.launchApp();
});

beforeEach(async () => {
  await device.reloadReactNative();
});

afterEach(async () => {
  // Limpar estado se necessário
});

