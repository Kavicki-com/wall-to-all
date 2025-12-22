/**
 * Utilitários para formatação e validação de avaliações
 */

/**
 * Valida se um rating está no intervalo válido (1-5)
 */
export const isValidRating = (rating: number | null | undefined): boolean => {
  return rating !== null && rating !== undefined && rating >= 1 && rating <= 5;
};

/**
 * Valida se um comentário está dentro do limite de caracteres
 */
export const isValidComment = (comment: string | null | undefined, maxLength: number = 500): boolean => {
  if (!comment) return true; // Comentário é opcional
  return comment.length <= maxLength;
};

/**
 * Formata a data de uma avaliação para exibição
 */
export const formatReviewDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Hoje';
    } else if (diffInDays === 1) {
      return 'Ontem';
    } else if (diffInDays < 7) {
      return `${diffInDays} dias atrás`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'} atrás`;
    } else if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30);
      return `${months} ${months === 1 ? 'mês' : 'meses'} atrás`;
    } else {
      const years = Math.floor(diffInDays / 365);
      return `${years} ${years === 1 ? 'ano' : 'anos'} atrás`;
    }
  } catch (error) {
    return '';
  }
};

/**
 * Formata a data completa de uma avaliação
 */
export const formatReviewDateFull = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch (error) {
    return '';
  }
};

