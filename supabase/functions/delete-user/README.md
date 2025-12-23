# Edge Function: Delete User

Esta Edge Function deleta um usuário do `auth.users` usando o Supabase Admin API.

## 📋 Descrição

Permite que usuários autenticados deletem suas próprias contas do sistema de autenticação do Supabase.

## ⚙️ Segurança

### Autenticação
- Requer token JWT válido no header `Authorization`
- Apenas o próprio usuário pode deletar sua conta
- Usa Supabase Admin API para deletar do `auth.users`

### Variáveis de Ambiente Necessárias
- `SUPABASE_URL`: URL do projeto Supabase
- `SUPABASE_ANON_KEY`: Chave anônima do Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Chave de service role (admin)

## 🚀 Deploy

### Via Supabase CLI

```bash
# Fazer login
supabase login

# Linkar ao projeto
supabase link --project-ref seu-project-ref

# Deploy da função
supabase functions deploy delete-user

# Definir secrets (se necessário)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

### Via Supabase Dashboard

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Vá em **Edge Functions**
3. Clique em **Create a new function**
4. Nome: `delete-user`
5. Cole o conteúdo de `index.ts`
6. Clique em **Deploy**
7. Configure os secrets necessários em **Function Settings**

## 📡 Uso

### Chamada da Função

```typescript
import { supabase } from './lib/supabase';

const deleteUserAccount = async () => {
  try {
    // 1. Deletar dados relacionados primeiro (appointments, reviews, profiles, etc)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    // Deletar dados do banco
    await supabase.from('appointments').delete().eq('client_id', user.id);
    await supabase.from('reviews').delete().eq('client_id', user.id);
    await supabase.from('profiles').delete().eq('id', user.id);

    // 2. Chamar a Edge Function para deletar do auth.users
    const { data, error } = await supabase.functions.invoke('delete-user', {
      method: 'POST',
    });

    if (error) {
      throw error;
    }

    console.log('Conta deletada com sucesso:', data);
    
    // 3. Fazer logout
    await supabase.auth.signOut();
    
  } catch (error) {
    console.error('Erro ao deletar conta:', error);
    throw error;
  }
};
```

### Resposta de Sucesso

```json
{
  "success": true,
  "message": "Usuário deletado com sucesso"
}
```

### Resposta de Erro

```json
{
  "error": "Erro ao deletar usuário",
  "details": "Mensagem de erro detalhada"
}
```

## 🔒 Fluxo Recomendado de Exclusão

1. **Confirmação do Usuário**: Pedir confirmação explícita
2. **Deletar Dados Relacionados**: Limpar todas as tabelas do banco
3. **Chamar Edge Function**: Deletar do auth.users
4. **Logout**: Encerrar sessão
5. **Redirecionar**: Enviar para tela de login

## ⚠️ Importante

- **Ação Irreversível**: A exclusão não pode ser desfeita
- **Ordem de Exclusão**: Sempre delete os dados relacionados ANTES de chamar esta função
- **Foreign Keys**: Certifique-se de que não há constraints que impeçam a exclusão
- **Cascata**: Configure ON DELETE CASCADE nas foreign keys quando apropriado

## 🔧 Troubleshooting

### Erro: "Não autenticado"
- Verifique se o token JWT está sendo enviado corretamente
- Verifique se a sessão do usuário está ativa

### Erro: "SUPABASE_SERVICE_ROLE_KEY não definida"
- Configure o secret no Supabase Dashboard
- Em desenvolvimento local, adicione ao arquivo `.env`

### Erro: "Erro ao deletar usuário"
- Verifique se há dados relacionados que impedem a exclusão
- Verifique as foreign keys e constraints do banco
- Revise os logs da função no Dashboard

## 📊 Monitoramento

Monitore a função através do Supabase Dashboard:
- **Edge Functions** → **delete-user** → **Logs**
- Verifique tentativas de exclusão
- Identifique erros e padrões

## 🔗 Referências

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Admin API](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
- [GDPR e Exclusão de Dados](https://gdpr-info.eu/art-17-gdpr/)

