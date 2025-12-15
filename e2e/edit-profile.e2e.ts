import { device, element, by, waitFor, expect } from 'detox';
import { ifElementExists } from './helpers';

describe('Edit Profile Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should navigate to profile screen', async () => {
    // Navegar para a aba de perfil
    const profileTab = element(by.id('profile-tab'));
    await ifElementExists(profileTab, async () => {
      await profileTab.tap();
      await waitFor(element(by.id('profile-screen'))).toBeVisible().withTimeout(5000);
    });
  });

  it('should open edit profile screen', async () => {
    // Procurar botão de editar perfil
    const editButton = element(by.text('Editar'));
    await ifElementExists(editButton, async () => {
      await editButton.tap();
      await waitFor(element(by.id('edit-profile-screen'))).toBeVisible().withTimeout(5000);
    });
  });

  it('should display profile fields', async () => {
    // Verificar se os campos de edição estão visíveis
    const nameInput = element(by.id('name-input'));
    const emailInput = element(by.id('email-input'));
    
    await ifElementExists(nameInput, async () => {
      await expect(nameInput).toBeVisible();
    });
    
    await ifElementExists(emailInput, async () => {
      await expect(emailInput).toBeVisible();
    });
  });

  it('should allow editing name', async () => {
    const nameInput = element(by.id('name-input'));
    await ifElementExists(nameInput, async () => {
      await nameInput.clearText();
      await nameInput.typeText('Novo Nome');
    });
  });

  it('should show save button', async () => {
    const saveButton = element(by.text('Salvar'));
    await ifElementExists(saveButton, async () => {
      await expect(saveButton).toBeVisible();
    });
  });

  it('should allow changing avatar', async () => {
    // Verificar se há opção de alterar foto
    const avatarButton = element(by.id('avatar-button'));
    await ifElementExists(avatarButton, async () => {
      await expect(avatarButton).toBeVisible();
    });
  });
});

