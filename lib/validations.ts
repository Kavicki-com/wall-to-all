/**
 * Validações de formulários
 */

/**
 * Valida CPF (Cadastro de Pessoa Física)
 * @param cpf - CPF a ser validado (com ou sem formatação)
 * @returns true se o CPF é válido
 */
export const validateCPF = (cpf: string): boolean => {
  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/\D/g, '');

  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) {
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
export const validateCNPJ = (cnpj: string): boolean => {
  // Remove caracteres não numéricos
  const cleanCNPJ = cnpj.replace(/\D/g, '');

  // Verifica se tem 14 dígitos
  if (cleanCNPJ.length !== 14) {
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
 * Valida formato de email
 * @param email - Email a ser validado
 * @returns true se o email é válido
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Valida formato de telefone brasileiro
 * @param phone - Telefone a ser validado (com ou sem formatação)
 * @returns true se o telefone é válido
 */
export const validatePhone = (phone: string): boolean => {
  // Remove caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');

  // Telefone brasileiro deve ter 10 ou 11 dígitos (com DDD)
  // 10 dígitos: (XX) XXXX-XXXX
  // 11 dígitos: (XX) 9XXXX-XXXX (celular)
  return cleanPhone.length === 10 || cleanPhone.length === 11;
};
