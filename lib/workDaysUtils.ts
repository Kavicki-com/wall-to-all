/**
 * Utilitário para formatar horários de funcionamento
 */

type WorkDay = {
  start: string;
  end: string;
};

type WorkDays = Record<string, WorkDay> | null;

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const DAY_NAMES: Record<string, string> = {
  monday: 'Seg',
  tuesday: 'Ter',
  wednesday: 'Qua',
  thursday: 'Qui',
  friday: 'Sex',
  saturday: 'Sáb',
  sunday: 'Dom',
};

/**
 * Formata horários de funcionamento de forma inteligente
 * Agrupa dias consecutivos com o mesmo horário
 */
export const formatWorkDays = (workDays: WorkDays): string => {
  if (!workDays) return 'Não informado';

  const days = Object.keys(workDays);
  if (days.length === 0) return 'Não informado';

  // Ordenar dias pela ordem da semana
  const sortedDays = days.sort((a, b) => {
    const indexA = DAY_ORDER.indexOf(a as typeof DAY_ORDER[number]);
    const indexB = DAY_ORDER.indexOf(b as typeof DAY_ORDER[number]);
    return indexA - indexB;
  });

  // Agrupar dias consecutivos com o mesmo horário
  const groups: Array<{ startDay: string; endDay: string; start: string; end: string }> = [];
  
  for (let i = 0; i < sortedDays.length; i++) {
    const currentDay = sortedDays[i];
    const currentData = workDays[currentDay];
    
    // Verificar se pode agrupar com o grupo anterior
    if (groups.length > 0) {
      const lastGroup = groups[groups.length - 1];
      const lastDayIndex = DAY_ORDER.indexOf(lastGroup.endDay as typeof DAY_ORDER[number]);
      const currentDayIndex = DAY_ORDER.indexOf(currentDay as typeof DAY_ORDER[number]);
      
      // Se é consecutivo e tem o mesmo horário, agrupa
      if (
        currentDayIndex === lastDayIndex + 1 &&
        currentData.start === lastGroup.start &&
        currentData.end === lastGroup.end
      ) {
        lastGroup.endDay = currentDay;
        continue;
      }
    }
    
    // Criar novo grupo
    groups.push({
      startDay: currentDay,
      endDay: currentDay,
      start: currentData.start,
      end: currentData.end,
    });
  }

  // Formatar grupos
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    return minutes && minutes !== '00' ? `${hours}h${minutes}` : `${hours}h`;
  };

  const formatGroup = (group: typeof groups[0]) => {
    const startDayName = DAY_NAMES[group.startDay] || group.startDay;
    const endDayName = DAY_NAMES[group.endDay] || group.endDay;
    
    const dayRange = group.startDay === group.endDay 
      ? startDayName 
      : `${startDayName} à ${endDayName}`;
    
    return `${dayRange} - ${formatTime(group.start)} às ${formatTime(group.end)}`;
  };

  // Se há apenas um grupo, retorna direto
  if (groups.length === 1) {
    return formatGroup(groups[0]);
  }

  // Se há múltiplos grupos, retorna o primeiro e último (ou todos se forem poucos)
  if (groups.length <= 3) {
    return groups.map(formatGroup).join(', ');
  }

  // Se há muitos grupos, mostra o primeiro e último
  return `${formatGroup(groups[0])} ... ${formatGroup(groups[groups.length - 1])}`;
};

