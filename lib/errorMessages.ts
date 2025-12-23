/**
 * Mensagens de erro padronizadas em português
 * Centraliza todas as mensagens de erro do aplicativo para manter consistência
 */

export type ErrorContext =
  | 'auth'
  | 'signup'
  | 'login'
  | 'profile'
  | 'appointment'
  | 'service'
  | 'upload'
  | 'settings'
  | 'home'
  | 'general';

export type ErrorCategory =
  | 'network'
  | 'auth'
  | 'validation'
  | 'notFound'
  | 'permission'
  | 'timeout'
  | 'unknown';

/**
 * Mensagens genéricas por categoria de erro
 */
export const ERROR_MESSAGES: Record<ErrorCategory, string> = {
  network: 'Verifique sua conexão com a internet e tente novamente',
  auth: 'Sessão expirada. Faça login novamente',
  validation: 'Dados inválidos. Verifique as informações e tente novamente',
  notFound: 'Item não encontrado',
  permission: 'Permissão negada. Verifique as configurações do aplicativo',
  timeout: 'A operação demorou muito. Tente novamente',
  unknown: 'Ocorreu um erro inesperado. Tente novamente',
};

/**
 * Mensagens específicas por contexto
 */
export const CONTEXT_MESSAGES: Record<ErrorContext, Partial<Record<ErrorCategory, string>>> = {
  auth: {
    network: 'Erro de conexão ao autenticar. Verifique sua internet e tente novamente',
    auth: 'Sessão expirada. Faça login novamente',
    validation: 'Credenciais inválidas. Verifique e-mail e senha',
    unknown: 'Erro ao autenticar. Tente novamente',
  },
  signup: {
    network: 'Falha ao criar conta. Verifique sua conexão e tente novamente',
    validation: 'Dados inválidos. Verifique as informações e tente novamente',
    auth: 'E-mail já cadastrado. Tente fazer login',
    unknown: 'Falha ao criar conta. Tente novamente',
  },
  login: {
    network: 'Erro de conexão ao fazer login. Verifique sua internet e tente novamente',
    auth: 'E-mail ou senha inválidos',
    validation: 'Preencha e-mail e senha corretamente',
    unknown: 'Erro ao fazer login. Tente novamente',
  },
  profile: {
    network: 'Erro ao carregar perfil. Verifique sua conexão e tente novamente',
    notFound: 'Perfil não encontrado',
    auth: 'A nova senha deve ser diferente da senha atual',
    unknown: 'Erro ao carregar perfil. Tente novamente',
  },
  appointment: {
    network: 'Falha ao criar agendamento. Verifique sua conexão e tente novamente',
    validation: 'Dados do agendamento inválidos. Verifique e tente novamente',
    notFound: 'Agendamento não encontrado',
    timeout: 'Falha ao processar agendamento. Tente novamente',
    unknown: 'Erro ao processar agendamento. Tente novamente',
  },
  service: {
    network: 'Erro ao carregar serviços. Verifique sua conexão e tente novamente',
    notFound: 'Serviço não encontrado',
    validation: 'Dados do serviço inválidos. Verifique e tente novamente',
    unknown: 'Erro ao processar serviço. Tente novamente',
  },
  upload: {
    network: 'Falha ao fazer upload da imagem. Verifique sua conexão e tente novamente',
    permission: 'Permissão negada. Verifique as configurações do aplicativo para acessar fotos',
    validation: 'Imagem inválida. Use formatos JPG, PNG ou WEBP',
    timeout: 'Upload demorou muito. Tente novamente',
    unknown: 'Erro ao fazer upload. Tente novamente',
  },
  settings: {
    network: 'Erro ao carregar configurações. Verifique sua conexão e tente novamente',
    unknown: 'Erro ao carregar configurações. Tente novamente',
  },
  home: {
    network: 'Erro ao carregar dados. Verifique sua conexão e tente novamente',
    unknown: 'Erro ao carregar dados. Tente novamente',
  },
  general: {
    network: 'Erro de conexão. Verifique sua internet e tente novamente',
    unknown: 'Ocorreu um erro inesperado. Tente novamente',
  },
};

/**
 * Obtém mensagem de erro baseada no contexto e categoria
 */
export const getErrorMessage = (
  category: ErrorCategory,
  context: ErrorContext = 'general'
): string => {
  // Tenta obter mensagem específica do contexto
  const contextMessage = CONTEXT_MESSAGES[context]?.[category];
  if (contextMessage) {
    return contextMessage;
  }

  // Fallback para mensagem genérica da categoria
  return ERROR_MESSAGES[category];
};

/**
 * Mensagens de sucesso padronizadas
 */
export const SUCCESS_MESSAGES: Record<string, string> = {
  profileUpdated: 'Perfil atualizado com sucesso',
  passwordChanged: 'Senha alterada com sucesso',
  appointmentCreated: 'Agendamento criado com sucesso',
  appointmentRescheduled: 'Agendamento reagendado com sucesso',
  serviceCreated: 'Serviço criado com sucesso',
  serviceUpdated: 'Serviço atualizado com sucesso',
  imageUploaded: 'Imagem enviada com sucesso',
};
