# Guia de Deploy para Produção - Wall-to-All

Este guia descreve o processo completo de deploy do Wall-to-All para produção.

## 📋 Pré-requisitos

- [ ] Conta no Supabase com projeto criado
- [ ] Conta no Expo/EAS para builds
- [ ] Variáveis de ambiente configuradas
- [ ] Migrações do banco aplicadas
- [ ] Edge Functions deployadas (se aplicável)

## 🔐 1. Configuração de Variáveis de Ambiente

### Variáveis Necessárias

Crie um arquivo `.env.production` (não commitar no git):

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui

# Sentry (Opcional mas recomendado)
EXPO_PUBLIC_SENTRY_DSN=https://sua-dsn-do-sentry
EXPO_PUBLIC_ENV=production

# Outras variáveis conforme necessário
```

### Configuração no EAS

```bash
# Configurar secrets no EAS
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_ENV --value "production"
```

## 🗄️ 2. Configuração do Banco de Dados

### Aplicar Migrações

1. **Acesse o Supabase Dashboard**
   - Vá em **SQL Editor**
   - Execute as migrações na ordem:
     - `20250115000000_consolidate_notifications_policies.sql`
     - `20250115000001_add_performance_indexes.sql`
     - `20250115000002_review_public_policies.sql` (revisão manual)

2. **Verificar Políticas RLS**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'notifications';
   ```

3. **Verificar Índices**
   ```sql
   SELECT indexname, tablename 
   FROM pg_indexes 
   WHERE indexname LIKE 'idx_%';
   ```

### Configurar RLS

- Verifique que todas as tabelas têm RLS habilitado
- Revise políticas aplicadas a `public`
- Teste permissões de cada role

## ⚡ 3. Deploy de Edge Functions

### Rate Limiting

```bash
# Via CLI
supabase functions deploy rate-limit

# Ou via Dashboard
# Edge Functions → Create → rate-limit
```

## 📱 4. Build da Aplicação

### Configurar EAS Build

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Fazer login
eas login

# Configurar projeto
eas build:configure
```

### Build para Produção

```bash
# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production

# Ambos
eas build --platform all --profile production
```

### Verificar Build

- Acompanhe o progresso no [Expo Dashboard](https://expo.dev)
- Baixe os arquivos `.apk` (Android) ou `.ipa` (iOS)
- Teste em dispositivos físicos antes de publicar

## 🚀 5. Publicação

### Android (Google Play Store)

1. **Criar App Bundle**
   ```bash
   eas build --platform android --profile production
   ```

2. **Upload para Play Console**
   - Acesse [Google Play Console](https://play.google.com/console)
   - Crie novo app ou selecione existente
   - Upload do `.aab` gerado
   - Preencha informações do app
   - Submeta para revisão

### iOS (App Store)

1. **Criar Build**
   ```bash
   eas build --platform ios --profile production
   ```

2. **Upload para App Store Connect**
   - Acesse [App Store Connect](https://appstoreconnect.apple.com)
   - Crie novo app ou selecione existente
   - Use Transporter ou Xcode para upload do `.ipa`
   - Preencha informações do app
   - Submeta para revisão

## ✅ 6. Checklist Pós-Deploy

### Segurança

- [ ] Todas as variáveis de ambiente configuradas
- [ ] Credenciais não estão no código
- [ ] Políticas RLS revisadas e testadas
- [ ] Rate limiting ativo
- [ ] Logs não expõem informações sensíveis

### Performance

- [ ] Índices criados e funcionando
- [ ] Queries N+1 corrigidas
- [ ] Cache implementado
- [ ] Debounce em buscas ativo

### Monitoramento

- [ ] Sentry configurado e capturando erros
- [ ] Analytics configurado (se aplicável)
- [ ] Logs centralizados (se aplicável)

### Testes

- [ ] Testado em dispositivos físicos
- [ ] Testado em diferentes versões de OS
- [ ] Testado fluxos críticos:
  - [ ] Login/Signup
  - [ ] Busca de serviços
  - [ ] Agendamento
  - [ ] Notificações

## 🔄 7. Atualizações Futuras

### Processo de Atualização

1. **Desenvolvimento**
   - Fazer alterações na branch de desenvolvimento
   - Testar localmente

2. **Staging**
   - Deploy para ambiente de staging
   - Testes completos

3. **Produção**
   - Merge para main
   - Build de produção
   - Publicação nas stores

### Rollback

Em caso de problemas:

1. **Reverter código**
   ```bash
   git revert <commit-hash>
   ```

2. **Build anterior**
   - Use build anterior das stores
   - Ou faça novo build com código revertido

3. **Banco de dados**
   - Se necessário, reverta migrações
   - Restaure backup se disponível

## 📊 8. Monitoramento Contínuo

### Métricas a Acompanhar

- **Erros:** Taxa de erros no Sentry
- **Performance:** Tempo de resposta de queries
- **Uso:** Número de usuários ativos
- **Crashes:** Taxa de crashes do app

### Alertas Recomendados

- Erros críticos (> 1% de requisições)
- Crashes frequentes
- Performance degradada
- Rate limiting excessivo

## 🔗 Referências

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Supabase Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)
- [React Native Performance](https://reactnative.dev/docs/performance)

## 📞 Suporte

Em caso de problemas:
1. Verifique logs no Sentry
2. Verifique logs no Supabase Dashboard
3. Consulte documentação oficial
4. Entre em contato com a equipe de desenvolvimento



