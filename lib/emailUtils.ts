/**
 * Utilitários para tratamento de e-mail
 */

const COMMON_DOMAINS = [
    'gmail.com',
    'hotmail.com',
    'outlook.com',
    'yahoo.com',
    'icloud.com',
    'live.com',
    'uol.com.br',
    'terra.com.br',
    'ig.com.br',
];

const TYPO_MAP: Record<string, string> = {
    'gmil.com': 'gmail.com',
    'gimail.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'hotmial.com': 'hotmail.com',
    'hotamail.com': 'hotmail.com',
    'hotmal.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outloock.com': 'outlook.com',
    'yaho.com': 'yahoo.com',
    'yhaoo.com': 'yahoo.com',
};

/**
 * Sugere uma correção de e-mail se o domínio parecer um erro comum
 * @param email - E-mail digitado
 * @returns Sugestão de e-mail corrigido ou null se não houver sugestão óbvia
 */
export const suggestEmailCorrection = (email: string): string | null => {
    if (!email || !email.includes('@')) return null;

    const [user, domain] = email.split('@');
    if (!domain) return null;

    const lowDomain = domain.toLowerCase();

    // Verifica no mapa de erros comuns
    if (TYPO_MAP[lowDomain]) {
        return `${user}@${TYPO_MAP[lowDomain]}`;
    }

    // Se não estiver no mapa, mas for muito similar a um comum (opcional - simplificado por enquanto)
    // Por enquanto usaremos apenas o mapa de typos conhecidos conforme solicitado ("lógica simples")

    return null;
};
