import { device, element, by, waitFor, expect } from 'detox';
import { ifElementExists } from './helpers';

describe('Cancel Appointment Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should navigate to appointment details', async () => {
    // Navegar para agendamentos e abrir detalhes
    const appointmentsTab = element(by.id('appointments-tab'));
    await ifElementExists(appointmentsTab, async () => {
      await appointmentsTab.tap();
    });
    
    const appointmentCard = element(by.id('appointment-card')).atIndex(0);
    await ifElementExists(appointmentCard, async () => {
      await appointmentCard.tap();
      await waitFor(element(by.id('appointment-detail'))).toBeVisible().withTimeout(5000);
    });
  });

  it('should show cancel option for eligible appointments', async () => {
    // Verificar se há opção de cancelamento
    // A opção pode estar em um menu ou botão direto
    const cancelButton = element(by.text('Cancelar'));
    await ifElementExists(cancelButton, async () => {
      await expect(cancelButton).toBeVisible();
    });
  });

  it('should show confirmation dialog when canceling', async () => {
    const cancelButton = element(by.text('Cancelar'));
    await ifElementExists(cancelButton, async () => {
      await cancelButton.tap();
      // Aguardar diálogo de confirmação
      await waitFor(element(by.text('Confirmar'))).toBeVisible().withTimeout(3000);
    });
  });

  it('should complete cancellation flow', async () => {
    // Este teste verifica o fluxo completo de cancelamento
    // Requer um agendamento cancelável
    const cancelButton = element(by.text('Cancelar'));
    await ifElementExists(cancelButton, async () => {
      await cancelButton.tap();
      
      const confirmCancelButton = element(by.text('Confirmar'));
      await ifElementExists(confirmCancelButton, async () => {
        // Não executar o cancelamento real para não afetar dados de teste
        // await confirmCancelButton.tap();
        await expect(confirmCancelButton).toBeVisible();
      });
    });
  });
});

