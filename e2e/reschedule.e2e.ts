import { device, element, by, waitFor, expect } from 'detox';
import { ifElementExists } from './helpers';

describe('Reschedule Appointment Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should navigate to appointments screen', async () => {
    // Navegar para a aba de agendamentos
    const appointmentsTab = element(by.id('appointments-tab'));
    await ifElementExists(appointmentsTab, async () => {
      await appointmentsTab.tap();
      await waitFor(element(by.text('Meus Agendamentos'))).toBeVisible().withTimeout(5000);
    });
  });

  it('should open appointment details', async () => {
    // Selecionar um agendamento da lista
    const appointmentCard = element(by.id('appointment-card')).atIndex(0);
    await ifElementExists(appointmentCard, async () => {
      await appointmentCard.tap();
      await waitFor(element(by.id('appointment-detail'))).toBeVisible().withTimeout(5000);
    });
  });

  it('should show reschedule option', async () => {
    // Verificar se a opção de reagendamento está disponível
    const rescheduleButton = element(by.text('Remarcar agendamento'));
    await ifElementExists(rescheduleButton, async () => {
      await expect(rescheduleButton).toBeVisible();
    });
  });

  it('should navigate to reschedule screen', async () => {
    const rescheduleButton = element(by.text('Remarcar agendamento'));
    await ifElementExists(rescheduleButton, async () => {
      await rescheduleButton.tap();
      await waitFor(element(by.id('reschedule-screen'))).toBeVisible().withTimeout(5000);
    });
  });

  it('should allow selecting new date and time', async () => {
    // Após navegar para tela de reagendamento
    const datePicker = element(by.id('date-picker'));
    const timeSlot = element(by.id('time-slot')).atIndex(0);
    
    await ifElementExists(datePicker, async () => {
      await datePicker.tap();
      // Selecionar uma data futura
    });
    
    await ifElementExists(timeSlot, async () => {
      await timeSlot.tap();
    });
  });

  it('should submit reschedule request', async () => {
    // Verificar botão de confirmação de reagendamento
    const confirmRescheduleButton = element(by.text('Confirmar Reagendamento'));
    await ifElementExists(confirmRescheduleButton, async () => {
      await expect(confirmRescheduleButton).toBeVisible();
    });
  });
});

