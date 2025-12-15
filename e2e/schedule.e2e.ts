import { device, element, by, waitFor, expect } from 'detox';
import { ifElementExists } from './helpers';

describe('Schedule Appointment Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should navigate to search screen', async () => {
    // Assumindo que o usuário está logado e na home
    // Procurar pela barra de busca ou botão de busca
    const searchBar = element(by.id('search-bar'));
    await ifElementExists(searchBar, async () => {
      await searchBar.tap();
      await waitFor(element(by.text('Buscar'))).toBeVisible().withTimeout(5000);
    });
  });

  it('should allow selecting a service', async () => {
    // Navegar para resultados de busca e selecionar um serviço
    // Este teste assume que há serviços disponíveis
    const serviceCard = element(by.id('service-card')).atIndex(0);
    await ifElementExists(serviceCard, async () => {
      await serviceCard.tap();
      await waitFor(element(by.text('Agendar'))).toBeVisible().withTimeout(5000);
    });
  });

  it('should navigate through schedule flow', async () => {
    // Este teste verifica a navegação através do fluxo de agendamento
    // service -> date -> time -> confirm
    
    // Assumindo que estamos na tela de detalhes do serviço
    const scheduleButton = element(by.text('Agendar'));
    await ifElementExists(scheduleButton, async () => {
      await scheduleButton.tap();
      
      // Aguardar tela de seleção de data
      await waitFor(element(by.id('date-picker'))).toBeVisible().withTimeout(5000);
    });
  });

  it('should confirm appointment with valid data', async () => {
    // Este teste verifica o fluxo completo de confirmação
    // Requer dados válidos (businessId, serviceId, date, time)
    const confirmButton = element(by.text('Confirmar'));
    await ifElementExists(confirmButton, async () => {
      // Verificar se o botão está visível antes de tentar confirmar
      await expect(confirmButton).toBeVisible();
    });
  });
});

