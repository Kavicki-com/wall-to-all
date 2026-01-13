/**
 * Validações de formulários
 */

/**
 * Valida CPF (Cadastro de Pessoa Física)
 * @param cpf - CPF a ser validado (com ou sem formatação)
 * @returns true se o CPF é válido
 */
export const validateCPF = (cpf: string | null | undefined): boolean => {
  if (!cpf || typeof cpf !== 'string') {
    return false;
  }

  // Valida tamanho máximo antes de limpar (20 caracteres)
  if (cpf.length > 20) {
    return false;
  }

  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/\D/g, '');

  // Verifica se após limpar tem apenas números e 11 dígitos
  if (!/^\d{11}$/.test(cleanCPF)) {
    return false;
  }

  // Verifica se todos os dígitos são iguais (CPF inválido)
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    return false;
  }

  // Validação dos dígitos verificadores
  let sum = 0;
  let remainder: number;

  // Valida primeiro dígito verificador
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) {
    return false;
  }

  // Valida segundo dígito verificador
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) {
    return false;
  }

  return true;
};

/**
 * Valida CNPJ (Cadastro Nacional de Pessoa Jurídica)
 * @param cnpj - CNPJ a ser validado (com ou sem formatação)
 * @returns true se o CNPJ é válido
 */
export const validateCNPJ = (cnpj: string | null | undefined): boolean => {
  if (!cnpj || typeof cnpj !== 'string') {
    return false;
  }

  // Valida tamanho máximo antes de limpar (20 caracteres)
  if (cnpj.length > 20) {
    return false;
  }

  // Remove caracteres não numéricos
  const cleanCNPJ = cnpj.replace(/\D/g, '');

  // Verifica se após limpar tem apenas números e 14 dígitos
  if (!/^\d{14}$/.test(cleanCNPJ)) {
    return false;
  }

  // Verifica se todos os dígitos são iguais (CNPJ inválido)
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) {
    return false;
  }

  // Validação dos dígitos verificadores
  let length = cleanCNPJ.length - 2;
  let numbers = cleanCNPJ.substring(0, length);
  const digits = cleanCNPJ.substring(length);
  let sum = 0;
  let pos = length - 7;

  // Valida primeiro dígito verificador
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) {
    return false;
  }

  // Valida segundo dígito verificador
  length = length + 1;
  numbers = cleanCNPJ.substring(0, length);
  sum = 0;
  pos = length - 7;
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) {
    return false;
  }

  return true;
};

/**
 * Valida formato de horário (HH:mm)
 * @param time - Horário no formato HH:mm
 * @returns true se o horário é válido
 */
export const validateTime = (time: string): boolean => {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(time)) {
    return false;
  }

  const [hours, minutes] = time.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

/**
 * Valida se uma data é válida e não é no passado
 * @param date - Data a ser validada
 * @param allowPast - Se true, permite datas no passado (padrão: false)
 * @returns true se a data é válida
 */
export const validateDate = (date: Date, allowPast: boolean = false): boolean => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return false;
  }

  if (!allowPast) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);
    if (dateToCheck.getTime() < now.getTime()) {
      return false;
    }
  }

  return true;
};

/**
 * Valida formato de email (Strict)
 * @param email - Email a ser validado
 * @returns true se o email é válido
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const trimmedEmail = email.trim();

  // Valida tamanho máximo (RFC 5321: 255 caracteres)
  if (trimmedEmail.length > 255) {
    return false;
  }

  // Regex sugerida: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  // Esta regex exige @, domínio e TLD com pelo menos 2 caracteres, e aceita +
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  return emailRegex.test(trimmedEmail);
};

/**
 * Resultado da validação de senha
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Valida força de senha
 * @param password - Senha a ser validada
 * @returns Objeto com isValid e lista de erros
 */
export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['Senha é obrigatória.'] };
  }

  // Valida tamanho mínimo
  if (password.length < 8) {
    errors.push('Senha deve ter pelo menos 8 caracteres.');
  }

  // Valida tamanho máximo (128 caracteres)
  if (password.length > 128) {
    errors.push('Senha deve ter no máximo 128 caracteres.');
  }

  // Valida que não contém espaços
  if (/\s/.test(password)) {
    errors.push('Senha não pode conter espaços.');
  }

  // Valida que tem pelo menos um número
  if (!/\d/.test(password)) {
    errors.push('Senha deve conter pelo menos um número.');
  }

  // Valida que tem pelo menos uma letra
  if (!/[A-Za-z]/.test(password)) {
    errors.push('Senha deve conter pelo menos uma letra.');
  }

  // Valida que tem pelo menos um caractere especial
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Senha deve conter pelo menos um símbolo.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Sanitiza email (trim + lowercase)
 * @param email - Email a ser sanitizado
 * @returns Email sanitizado ou string vazia se inválido
 */
export const sanitizeEmail = (email: string): string => {
  if (!email || typeof email !== 'string') {
    return '';
  }
  return email.trim().toLowerCase();
};

/**
 * Sanitiza telefone (remove caracteres não numéricos)
 * @param phone - Telefone a ser sanitizado
 * @returns Telefone sanitizado (apenas dígitos) ou string vazia se inválido
 */
export const sanitizePhone = (phone: string): string => {
  if (!phone || typeof phone !== 'string') {
    return '';
  }
  return phone.replace(/\D/g, '');
};

/**
 * Sanitiza documento (CPF/CNPJ - remove caracteres não numéricos)
 * @param document - Documento a ser sanitizado
 * @returns Documento sanitizado (apenas dígitos) ou string vazia se inválido
 */
export const sanitizeDocument = (document: string | null | undefined): string => {
  if (!document || typeof document !== 'string') {
    return '';
  }
  return document.replace(/\D/g, '');
};

/**
 * Valida formato de telefone brasileiro
 * @param phone - Telefone a ser validado (com ou sem formatação)
 * @returns true se o telefone é válido
 */
export const validatePhone = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Valida tamanho máximo antes de limpar (20 caracteres)
  if (phone.length > 20) {
    return false;
  }

  // Remove caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');

  // Telefone brasileiro deve ter 10 ou 11 dígitos (com DDD)
  // 10 dígitos: (XX) XXXX-XXXX (fixo)
  // 11 dígitos: (XX) 9XXXX-XXXX (celular)
  if (cleanPhone.length !== 10 && cleanPhone.length !== 11) {
    return false;
  }

  // Rejeita telefones com todos dígitos iguais
  if (/^(\d)\1+$/.test(cleanPhone)) {
    return false;
  }

  // Valida DDD (primeiros 2 dígitos devem estar entre 11 e 99)
  const ddd = parseInt(cleanPhone.substring(0, 2), 10);
  if (ddd < 11 || ddd > 99) {
    return false;
  }

  // Para celular (11 dígitos), valida que o terceiro dígito é 9
  if (cleanPhone.length === 11) {
    const thirdDigit = cleanPhone.charAt(2);
    if (thirdDigit !== '9') {
      return false;
    }
  }

  return true;
};

/**
 * Valida CEP
 * @param cep - CEP formatado (XXXXX-XXX) ou apenas números
 * @returns true se o CEP é válido (8 dígitos)
 */
export const validateCEP = (cep: string): boolean => {
  const cleanCEP = cep.replace(/\D/g, '');
  return cleanCEP.length === 8;
};

/**
 * Valida cidade (apenas letras e acentos, sem números)
 * @param city - Nome da cidade
 * @returns true se a cidade é válida
 */
export const validateCity = (city: string): boolean => {
  if (!city || city.trim().length === 0) return false;
  // Regex: Apenas letras, acentos e espaços. Proibido números.
  const cityRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
  return cityRegex.test(city);
};

/**
 * Valida número do endereço (curto, aceita letras como "10B")
 * Rejeita strings muito longas ou sem números.
 * @param number - Número do endereço
 * @returns true se o número parece válido
 */
export const validateAddressNumber = (number: string): boolean => {
  if (!number || number.trim().length === 0) return false;
  if (number.length > 10) return false;

  const trimmed = number.trim();

  // Caso especial: Sem Número
  if (/^s\/n$/i.test(trimmed)) return true;

  // Deve começar com número ou ser algo como "Casa 1"
  // Vamos simplificar: deve conter pelo menos um dígito
  const hasDigit = /\d/.test(trimmed);
  if (!hasDigit) return false;

  // Regex para permitir: Números, letras, espaços, hífen e barra
  // Ex: "10B", "123-A", "45/B", "100 FUNDOS"
  const validPattern = /^[a-zA-Z0-9\s/-]+$/;
  if (!validPattern.test(trimmed)) return false;

  // Evitar lixo: Se tem letras após números, não deve ser uma string longa de letras repetitivas
  // Se contiver mais de 4 letras sem nenhum número por perto (simplificação)
  const alphaPart = trimmed.replace(/[^a-zA-Z]/g, '');
  if (alphaPart.length > 5) {
    // Se for algo como "FUNDOS", é ok. Se for "asasasas", talvez não.
    // Mas "FUNDOS" tem exatamente 6. Vamos permitir até 6 letras se acompanhadas de números.
    if (alphaPart.length > 6) return false;
  }

  return true;
};

/**
 * Valida bairro (não pode ser apenas números)
 * @param neighborhood - Nome do bairro
 * @returns true se o bairro é válido
 */
export const validateNeighborhood = (neighborhood: string): boolean => {
  if (!neighborhood || neighborhood.trim().length < 2) return false;
  // Rejeita se for apenas números
  return !/^\d+$/.test(neighborhood.trim());
};

/**
 * Lista de UFs do Brasil
 */
export const BRAZILIAN_STATES = [
  { label: 'AC', value: 'AC' },
  { label: 'AL', value: 'AL' },
  { label: 'AP', value: 'AP' },
  { label: 'AM', value: 'AM' },
  { label: 'BA', value: 'BA' },
  { label: 'CE', value: 'CE' },
  { label: 'DF', value: 'DF' },
  { label: 'ES', value: 'ES' },
  { label: 'GO', value: 'GO' },
  { label: 'MA', value: 'MA' },
  { label: 'MT', value: 'MT' },
  { label: 'MS', value: 'MS' },
  { label: 'MG', value: 'MG' },
  { label: 'PA', value: 'PA' },
  { label: 'PB', value: 'PB' },
  { label: 'PR', value: 'PR' },
  { label: 'PE', value: 'PE' },
  { label: 'PI', value: 'PI' },
  { label: 'RJ', value: 'RJ' },
  { label: 'RN', value: 'RN' },
  { label: 'RS', value: 'RS' },
  { label: 'RO', value: 'RO' },
  { label: 'RR', value: 'RR' },
  { label: 'SC', value: 'SC' },
  { label: 'SP', value: 'SP' },
  { label: 'SE', value: 'SE' },
  { label: 'TO', value: 'TO' },
] as const;
