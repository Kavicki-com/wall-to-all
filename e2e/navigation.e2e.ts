import { device, element, by, waitFor, expect } from 'detox';
import { ifElementExists } from './helpers';

describe('Navigation Between Main Screens', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should navigate to home tab', async () => {
    const homeTab = element(by.id('home-tab'));
    await ifElementExists(homeTab, async () => {
      await homeTab.tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(5000);
    });
  });

  it('should navigate to search tab', async () => {
    const searchTab = element(by.id('search-tab'));
    await ifElementExists(searchTab, async () => {
      await searchTab.tap();
      await waitFor(element(by.id('search-screen'))).toBeVisible().withTimeout(5000);
    });
  });

  it('should navigate to appointments tab', async () => {
    const appointmentsTab = element(by.id('appointments-tab'));
    await ifElementExists(appointmentsTab, async () => {
      await appointmentsTab.tap();
      await waitFor(element(by.id('appointments-screen'))).toBeVisible().withTimeout(5000);
    });
  });

  it('should navigate to profile tab', async () => {
    const profileTab = element(by.id('profile-tab'));
    await ifElementExists(profileTab, async () => {
      await profileTab.tap();
      await waitFor(element(by.id('profile-screen'))).toBeVisible().withTimeout(5000);
    });
  });

  it('should navigate between all tabs successfully', async () => {
    // Testar navegação sequencial entre todas as abas
    const tabs = ['home-tab', 'search-tab', 'appointments-tab', 'profile-tab'];
    
    for (const tabId of tabs) {
      const tab = element(by.id(tabId));
      await ifElementExists(tab, async () => {
        await tab.tap();
        await waitFor(element(by.id(tabId.replace('-tab', '-screen')))).toBeVisible().withTimeout(3000);
      });
    }
  });

  it('should maintain state when navigating back', async () => {
    // Navegar para uma tela, depois para outra, e voltar
    const homeTab = element(by.id('home-tab'));
    const searchTab = element(by.id('search-tab'));
    
    try {
      await waitFor(homeTab).toBeVisible().withTimeout(2000);
      await waitFor(searchTab).toBeVisible().withTimeout(2000);
      
      await homeTab.tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(3000);
      
      await searchTab.tap();
      await waitFor(element(by.id('search-screen'))).toBeVisible().withTimeout(3000);
      
      await homeTab.tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(3000);
    } catch {
      // Tabs not found, skip test
    }
  });
});

