/**
 * Calcula o preço total de um agendamento baseado no tipo de preço do serviço
 * 
 * @param servicePrice - Preço base do serviço
 * @param priceType - Tipo de preço: 'fixed' ou 'hourly'
 * @param durationMinutes - Duração do serviço em minutos (necessário apenas para 'hourly')
 * @returns Preço total calculado
 */
export const calculateAppointmentPrice = (
  servicePrice: number,
  priceType: 'fixed' | 'hourly',
  durationMinutes: number
): number => {
  if (priceType === 'fixed') {
    return servicePrice;
  }
  
  // Para preço por hora, calcular baseado na duração
  // durationMinutes / 60 converte minutos em horas
  return servicePrice * (durationMinutes / 60);
};

