import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInputProps } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletService } from '../../context/ServicesContext';
import { Icon } from '../ui/Icon';
import { CustomInput } from '../ui/CustomInput';
import { Chip } from '../ui/Chip';
import { useToast } from '../ui/ToastProvider';
import type { PixKeyType } from '../../lib/services/types';
import { colors } from '../../lib/theme';

// ── Configuração por tipo de chave ──────────────────────────────────────────

/** Ordem dos chips do seletor de tipo (single-select; default `cpf`). */
const PIX_TYPES: readonly PixKeyType[] = ['cpf', 'cnpj', 'email', 'phone', 'random'];

/** Rótulo pt-BR de cada tipo, exibido no chip. */
const TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
  random: 'Aleatória',
};

/** Props do input que variam com o tipo (placeholder/teclado/limite de caracteres). */
const INPUT_CONFIG: Record<
  PixKeyType,
  {
    placeholder: string;
    keyboardType: KeyboardTypeOptions;
    /** Limite do texto MASCARADO exibido (não do valor cru). */
    maxLength?: number;
    autoCapitalize?: TextInputProps['autoCapitalize'];
  }
> = {
  cpf: { placeholder: '000.000.000-00', keyboardType: 'numeric', maxLength: 14 },
  cnpj: { placeholder: '00.000.000/0000-00', keyboardType: 'numeric', maxLength: 18 },
  email: { placeholder: 'seu@email.com', keyboardType: 'email-address', autoCapitalize: 'none' },
  phone: { placeholder: '(00) 00000-0000', keyboardType: 'phone-pad', maxLength: 15 },
  random: { placeholder: '', keyboardType: 'default' },
};

/** Mensagem de erro inline por tipo (random é sempre válida → sem erro). */
const ERROR_MESSAGES: Record<PixKeyType, string | undefined> = {
  cpf: 'CPF inválido',
  cnpj: 'CNPJ inválido',
  email: 'E-mail inválido',
  phone: 'Telefone inválido',
  random: undefined,
};

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// ── Helpers de máscara/validação (manuais, sem lib nova) ────────────────────

/** Remove tudo que não for dígito. */
function onlyDigits(text: string): string {
  return text.replace(/\D/g, '');
}

/**
 * Converte o texto digitado no valor CRU guardado no estado, por tipo: tipos
 * numéricos viram dígitos puros (com corte no comprimento máximo); e-mail é
 * mantido como digitado; random não é editável (o handler nem dispara).
 */
function toRawValue(type: PixKeyType, text: string): string {
  switch (type) {
    case 'cpf':
      return onlyDigits(text).slice(0, 11);
    case 'cnpj':
      return onlyDigits(text).slice(0, 14);
    case 'phone':
      return onlyDigits(text).slice(0, 11);
    default:
      return text; // email (random é desabilitado)
  }
}

/** Máscara progressiva de CPF: `000.000.000-00`. */
function formatCpf(digits: string): string {
  const s = digits.slice(0, 11);
  let out = s.slice(0, 3);
  if (s.length > 3) out += `.${s.slice(3, 6)}`;
  if (s.length > 6) out += `.${s.slice(6, 9)}`;
  if (s.length > 9) out += `-${s.slice(9, 11)}`;
  return out;
}

/** Máscara progressiva de CNPJ: `00.000.000/0000-00`. */
function formatCnpj(digits: string): string {
  const s = digits.slice(0, 14);
  let out = s.slice(0, 2);
  if (s.length > 2) out += `.${s.slice(2, 5)}`;
  if (s.length > 5) out += `.${s.slice(5, 8)}`;
  if (s.length > 8) out += `/${s.slice(8, 12)}`;
  if (s.length > 12) out += `-${s.slice(12, 14)}`;
  return out;
}

/** Máscara progressiva de telefone: `(00) 00000-0000`. */
function formatPhone(digits: string): string {
  const s = digits.slice(0, 11);
  if (s.length === 0) return '';
  if (s.length <= 2) return `(${s}`;
  if (s.length <= 7) return `(${s.slice(0, 2)}) ${s.slice(2)}`;
  return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7, 11)}`;
}

/** Valor a exibir no input (mascarado para tipos numéricos; cru para email/random). */
function formatDisplay(type: PixKeyType, raw: string): string {
  switch (type) {
    case 'cpf':
      return formatCpf(raw);
    case 'cnpj':
      return formatCnpj(raw);
    case 'phone':
      return formatPhone(raw);
    default:
      return raw; // email / random
  }
}

/** Valida o valor CRU por tipo. `random` é sempre válida (chave gerada). */
function isValidValue(type: PixKeyType, raw: string): boolean {
  switch (type) {
    case 'cpf':
      return raw.length === 11;
    case 'cnpj':
      return raw.length === 14;
    case 'email':
      return EMAIL_RE.test(raw);
    case 'phone':
      return raw.length === 10 || raw.length === 11;
    case 'random':
      return raw.length > 0;
  }
}

/**
 * Gera uma chave aleatória tipo UUID v4 (mock, sem lib) — blocos hex 8-4-4-4-12.
 * `Math.random()` é permitido no código do app (só valores de exibição/mock).
 */
function generateRandomKey(): string {
  const hex = (): string => Math.floor(Math.random() * 16).toString(16);
  const block = (n: number): string => Array.from({ length: n }, hex).join('');
  return `${block(8)}-${block(4)}-4${block(3)}-${block(4)}-${block(12)}`;
}

export interface PixKeyFormProps {
  /** Chamado após o cadastro persistir com sucesso (os wrappers fazem `router.back()`). */
  onSaved: () => void;
}

/**
 * Formulário COMPARTILHADO de cadastro de chave Pix (Figma nodes 2660:6529
 * cliente / 2597:6009 lojista — mesmo layout). Reusado por dois wrappers finos
 * de rota (cliente e lojista) que só injetam o `onSaved`.
 *
 * Sub-tela navegável: usa o "Voltar" fantasma (mesma convenção da F1/Task 5 —
 * cadastro de cartão), sem a top bar navy do Figma. Mostra um seletor de TIPO
 * (linha de `Chip`s: CPF/CNPJ/E-mail/Telefone/Aleatória; single-select, default
 * CPF), um input de valor cuja máscara/placeholder/teclado mudam com o tipo, e a
 * CTA "Salvar chave".
 *
 * Máscara/validação manuais (sem lib), guardando o valor CRU no estado e exibindo
 * o mascarado. Trocar de tipo reseta valor + erros. Random gera uma chave (uma
 * vez, ao selecionar) e desabilita o input (sempre válida). A CTA fica
 * desabilitada enquanto inválido OU salvando. No sucesso, `addPixKey` persiste no
 * mock, dispara o toast e chama `onSaved`; a falha erra por toast. Guarda de
 * montagem no handler assíncrono (o usuário pode voltar durante o save) + guarda
 * contra duplo-submit.
 */
export const PixKeyForm: React.FC<PixKeyFormProps> = ({ onSaved }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const walletService = useWalletService();
  const { showSuccess, showError } = useToast();

  // Estado controlado — `value` guarda o valor CRU do tipo; a exibição é mascarada.
  const [type, setType] = useState<PixKeyType>('cpf');
  const [value, setValue] = useState('');
  // Campo "tocado" (blur) — só então o erro do valor aparece (estilo signup).
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Guarda de montagem para o setState assíncrono do save (o handler não faz
  // parte de um efeito; evita setState após unmount ao voltar durante o save).
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const valid = isValidValue(type, value);
  const disabled = !valid || saving;
  const error = touched && !valid ? ERROR_MESSAGES[type] : undefined;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Troca de tipo: reseta valor + touched. Para random, gera a chave (uma vez).
  const handleSelectType = useCallback(
    (next: PixKeyType) => {
      if (next === type) return;
      setType(next);
      setTouched(false);
      setValue(next === 'random' ? generateRandomKey() : '');
    },
    [type],
  );

  const handleChangeValue = useCallback(
    (text: string) => {
      setValue(toRawValue(type, text));
    },
    [type],
  );

  // Persiste a chave: guarda contra duplo-submit e submit inválido; confirma por
  // toast e chama onSaved, ou erra por toast. `finally` destrava o save.
  const handleSubmit = useCallback(() => {
    if (saving || !valid) return;
    setSaving(true);
    walletService
      .addPixKey({ type, value }) // valor CRU do tipo (dígitos/e-mail/chave gerada).
      .then(() => {
        showSuccess('Chave Pix adicionada');
        onSaved();
      })
      .catch(() => {
        showError('Não foi possível adicionar a chave.');
      })
      .finally(() => {
        // Guarda de montagem: o usuário pode ter voltado durante o save.
        if (mountedRef.current) setSaving(false);
      });
  }, [saving, valid, type, value, walletService, showSuccess, showError, onSaved]);

  const config = INPUT_CONFIG[type];
  const isRandom = type === 'random';

  return (
    <View style={styles.container}>
      {/* Header: "Voltar" fantasma (afordância real de navegação — sub-tela). */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          testID="btn-back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backButton}
          onPress={handleBack}
        >
          <Icon name="chevron-left" size={24} color={colors.brand} />
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Seção "tipo" — título + subtítulo + linha de chips (single-select). */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Qual tipo de chave?</Text>
          <Text style={styles.sectionSubtitle}>Escolha um dos tipos abaixo para cadastrar.</Text>
          <View style={styles.chipsRow}>
            {PIX_TYPES.map((t) => (
              <Chip
                key={t}
                label={TYPE_LABELS[t]}
                selected={type === t}
                onPress={() => handleSelectType(t)}
              />
            ))}
          </View>
        </View>

        {/* Seção "valor" — input com máscara/placeholder/teclado por tipo. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insira aqui a sua chave</Text>
          <CustomInput
            testID="input-pix-value"
            placeholder={config.placeholder}
            value={formatDisplay(type, value)}
            onChangeText={handleChangeValue}
            onBlur={() => setTouched(true)}
            keyboardType={config.keyboardType}
            maxLength={config.maxLength}
            autoCapitalize={config.autoCapitalize}
            autoCorrect={false}
            disabled={isRandom}
            helperText={
              isRandom ? 'Chave gerada automaticamente' : 'Será verificado automaticamente'
            }
            error={error}
          />
        </View>

        {/* CTA "Salvar chave" — navy, radius 24, texto branco bold. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salvar chave"
          accessibilityState={{ disabled }}
          testID="btn-save-pix"
          disabled={disabled}
          style={[styles.saveButton, disabled && styles.saveButtonDisabled]}
          onPress={handleSubmit}
        >
          <Text style={styles.saveButtonText}>Salvar chave</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // ── Header ───────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 16,
    color: colors.brand,
  },
  // ── Corpo ────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    rowGap: 24,
  },
  section: {
    rowGap: 12,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  sectionSubtitle: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 8,
  },
  // ── Salvar ───────────────────────────────────────────────
  saveButton: {
    height: 52,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
});
