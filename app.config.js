import { config } from 'dotenv';
import appJson from './app.json';

// Carrega .env.local primeiro (tem precedência), depois .env
// dotenv não sobrescreve variáveis já definidas, então .env.local tem precedência
config({ path: '.env.local' });
config(); // Carrega .env (padrão)

export default () => {
  // Função auxiliar para verificar se um valor é um placeholder
  const isPlaceholder = (value) => {
    if (!value) return true;
    const placeholders = [
      'https://SEU-PROJETO.supabase.co',
      'https://seu-projeto.supabase.co',
      'SEU_SUPABASE_ANON_KEY',
      'sua-chave-anon-aqui',
    ];
    return placeholders.includes(value);
  };

  // Detectar se estamos em contexto do EAS CLI (build/config check)
  // O EAS CLI precisa conseguir ler a config mesmo sem credenciais locais
  // As credenciais virão dos secrets durante o build
  const isEASContext =
    process.env.EAS_BUILD === 'true' ||
    process.env.EAS_BUILD_ID ||
    process.env.EXPO_PUBLIC_ENV === 'production' ||
    process.argv.some((arg) => arg.includes('eas') || arg.includes('expo config'));

  // Pega as variáveis de ambiente ou usa as do app.json como fallback (se não forem placeholders)
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const appJsonUrl = appJson.expo?.extra?.supabaseUrl;
  const appJsonKey = appJson.expo?.extra?.supabaseAnonKey;

  // Usa valores do app.json apenas se não forem placeholders
  const supabaseUrl = envUrl || (!isPlaceholder(appJsonUrl) ? appJsonUrl : undefined);
  const supabaseAnonKey = envKey || (!isPlaceholder(appJsonKey) ? appJsonKey : undefined);

  // VALIDAÇÃO: Falha explicitamente se as credenciais não estiverem configuradas
  // EXCETO em contexto do EAS, onde as credenciais virão dos secrets durante o build
  if (
    !isEASContext &&
    (!supabaseUrl ||
      !supabaseAnonKey ||
      isPlaceholder(supabaseUrl) ||
      isPlaceholder(supabaseAnonKey))
  ) {
    throw new Error(
      `
╔══════════════════════════════════════════════════════════════╗
║  ERRO: Variáveis de ambiente do Supabase não configuradas   ║
╚══════════════════════════════════════════════════════════════╝

Para corrigir este erro, você precisa configurar as credenciais do Supabase.

OPÇÃO 1 - Arquivo .env (Recomendado):
  1. Crie um arquivo .env na raiz do projeto
  2. Adicione as seguintes linhas:
  
     EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
     EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui

OPÇÃO 2 - Arquivo app.json:
  Adicione as credenciais em app.json:
  
    "expo": {
      "extra": {
        "supabaseUrl": "https://seu-projeto.supabase.co",
        "supabaseAnonKey": "sua-chave-anon-aqui"
      }
    }

COMO OBTER AS CREDENCIAIS:
  1. Acesse https://app.supabase.com
  2. Selecione seu projeto
  3. Vá em Settings > API
  4. Copie a "Project URL" e a "anon public key"

⚠️  NUNCA commite credenciais reais no código. Use apenas variáveis de ambiente.

NOTA: Em builds do EAS, as credenciais devem ser configuradas via secrets.
    `.trim(),
    );
  }

  // Em contexto do EAS, usar valores das variáveis de ambiente (que virão dos secrets)
  // ou placeholders temporários que serão substituídos durante o build
  const finalSupabaseUrl = supabaseUrl || (isEASContext ? appJsonUrl : undefined);
  const finalSupabaseAnonKey = supabaseAnonKey || (isEASContext ? appJsonKey : undefined);

  // Google Maps (Android): a key vem do ambiente (.env / secrets do EAS).
  // Fallback: placeholder do app.json — o build funciona, mas o mapa fica em branco.
  const GOOGLE_MAPS_PLACEHOLDER = 'PLACEHOLDER_REPLACE_ME';
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    appJson.expo?.android?.config?.googleMaps?.apiKey ||
    GOOGLE_MAPS_PLACEHOLDER;

  if (googleMapsApiKey === GOOGLE_MAPS_PLACEHOLDER) {
    console.warn(
      '[app.config] GOOGLE_MAPS_ANDROID_API_KEY not set — Android map will not render',
    );
  }

  return {
    expo: {
      ...appJson.expo,
      android: {
        ...appJson.expo?.android,
        config: {
          ...appJson.expo?.android?.config,
          googleMaps: {
            ...appJson.expo?.android?.config?.googleMaps,
            apiKey: googleMapsApiKey,
          },
        },
      },
      extra: {
        ...appJson.expo?.extra,
        supabaseUrl: finalSupabaseUrl,
        supabaseAnonKey: finalSupabaseAnonKey,
        eas: {
          ...appJson.expo?.extra?.eas,
        },
      },
    },
  };
};
