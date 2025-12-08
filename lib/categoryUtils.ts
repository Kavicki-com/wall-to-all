/**
 * Utilitário para ordenar categorias
 * Ordena alfabeticamente, mas "outros" sempre fica por último
 */

export type Category = {
  id: number;
  name: string;
  created_at?: string;
};

/**
 * Ordena categorias alfabeticamente, mas "outros" sempre fica por último
 * @param categories Array de categorias para ordenar
 * @returns Array de categorias ordenado
 */
export const sortCategories = <T extends Category>(categories: T[]): T[] => {
  return [...categories].sort((a, b) => {
    const nameA = a.name.toLowerCase().trim();
    const nameB = b.name.toLowerCase().trim();
    
    // Se uma for "outros" e a outra não, "outros" vai por último
    if (nameA === 'outros' && nameB !== 'outros') return 1;
    if (nameB === 'outros' && nameA !== 'outros') return -1;
    
    // Caso contrário, ordenação alfabética normal
    return nameA.localeCompare(nameB, 'pt-BR');
  });
};

