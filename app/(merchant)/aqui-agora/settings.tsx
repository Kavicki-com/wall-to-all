import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueueService } from '../../../context/ServicesContext';
import { Icon } from '../../../components/ui/Icon';
import { Chip } from '../../../components/ui/Chip';
import { Slider } from '../../../components/ui/Slider';
import { useToast } from '../../../components/ui/ToastProvider';
import { colors } from '../../../lib/theme';

/**
 * Presets de raio (km) — atalhos para os valores redondos do slider (0,5..10).
 * O slider passa por 0,5 em 0,5; os chips saltam direto para 1/3/5/10.
 */
const RADIUS_PRESETS: ReadonlyArray<number> = [1, 3, 5, 10];

/**
 * Presets de encerramento automático. `value` é o `autoCloseMinutes` do domínio;
 * `null` = "Não encerrar" (nunca desativa sozinho). null é um valor DISTINTO de
 * undefined aqui — updateSettings persiste null literalmente.
 */
const AUTOCLOSE_PRESETS: ReadonlyArray<{ label: string; value: number | null }> = [
  { label: '30 min', value: 30 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 },
  { label: '3h', value: 180 },
  { label: 'Não encerrar', value: null },
];

/**
 * Catálogo DECORATIVO de serviços "Aqui e Agora". O domínio da fila (QueueService)
 * NÃO modela um catálogo de serviços — estes cartões espelham o Figma (node
 * 2509:458) e sua seleção é puramente local (não é persistida). NÃO usamos
 * assets remotos do Figma: o "thumbnail" é um bloco de cor sólida.
 */
const SERVICE_CATALOG: ReadonlyArray<{ title: string; price: string }> = [
  { title: 'Corte de cabelo Masculino', price: 'R$ 65,00' },
  { title: 'Barba e Cabelo completo', price: 'R$ 95,00' },
  { title: 'Tratamento folicular para calvície', price: 'R$ 175,00' },
];

/** Formata o raio em pt-BR: "3 km", "0,5 km" (decimal com vírgula). */
function formatRadius(km: number): string {
  return `${String(km).replace('.', ',')} km`;
}

/**
 * Configurações do "Aqui e Agora" (lojista) — Figma node 2509:458. Tela rolável
 * com três seções: (1) "Raio de visibilidade" liga ao domínio (visibilityRadiusKm)
 * via slider + presets; (2) "Serviços disponíveis" é DECORATIVA com seleção só
 * local (o domínio não tem catálogo); (3) "Encerramento automático" liga ao
 * domínio (autoCloseMinutes, null = "Não encerrar"). No mount, `getSettings()`
 * inicializa raio e encerramento (guarda `active` ignora resoluções tardias). O
 * "Salvar" persiste APENAS os dois campos do domínio via `updateSettings` e
 * confirma com um toast de sucesso. Omitimos a top bar navy + menu do Figma por
 * ser uma sub-tela navegável (mesma convenção de fila/senha); o "Voltar" é a
 * afordância real de navegação.
 */
const MerchantAquiAgoraSettingsScreen: React.FC = () => {
  const router = useRouter();
  const queueService = useQueueService();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError } = useToast();

  // Campos do domínio (defaults espelham DEFAULT_QUEUE_SETTINGS do m1 até a carga).
  const [radiusKm, setRadiusKm] = useState(3);
  const [autoCloseMinutes, setAutoCloseMinutes] = useState<number | null>(120);
  // Seleção DECORATIVA e local dos serviços (índices selecionados). Começa com o
  // primeiro selecionado (espelha o Figma); NÃO é persistida.
  const [selectedServices, setSelectedServices] = useState<ReadonlySet<number>>(
    () => new Set<number>([0]),
  );
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Incrementado pelo "Tentar novamente" para re-disparar o efeito de carga.
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  // Guarda de montagem para o setState assíncrono do "Salvar" (o handler não faz
  // parte do efeito de carga; evita setState após unmount ao voltar durante o save).
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  // Carga inicial das configurações (settings são estáticas — sem assinatura). A
  // guarda `active` evita setState após o unmount / em resolução tardia.
  useEffect(() => {
    let active = true;
    setLoadError(false);
    setSettingsLoaded(false);
    queueService
      .getSettings()
      .then((settings) => {
        if (!active) return;
        setRadiusKm(settings.visibilityRadiusKm);
        setAutoCloseMinutes(settings.autoCloseMinutes);
        setSettingsLoaded(true);
      })
      .catch(() => {
        // Falha ao carregar: NÃO destrava o formulário com defaults fabricados
        // (Salvar sobrescreveria a config real ainda não vista). Mostra um estado
        // de erro com "Tentar novamente" (reloadKey re-dispara este efeito).
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [queueService, reloadKey]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const toggleService = useCallback((index: number) => {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // Persiste SÓ os campos do domínio (raio + encerramento). Guarda contra
  // duplo-submit e desabilita o botão em voo; confirma/erra por toast.
  const handleSave = useCallback(() => {
    if (saving) return;
    setSaving(true);
    queueService
      .updateSettings({ visibilityRadiusKm: radiusKm, autoCloseMinutes })
      .then(() => {
        showSuccess('Configurações salvas');
      })
      .catch(() => {
        showError('Não foi possível salvar. Tente novamente.');
      })
      .finally(() => {
        // Guarda de montagem: o usuário pode ter voltado durante o save.
        if (mountedRef.current) setSaving(false);
      });
  }, [saving, radiusKm, autoCloseMinutes, queueService, showSuccess, showError]);

  return (
    <View style={styles.container}>
      {/* Header: "Voltar" fantasma (afordância real de navegação — sem top bar
          navy, por ser sub-tela navegável). Fica fora do gate para estar sempre
          disponível durante a carga. */}
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

      {!settingsLoaded && !loadError ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : loadError ? (
        <View style={styles.loading}>
          <Text style={styles.errorText}>Não foi possível carregar as configurações.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tentar novamente"
            testID="btn-retry"
            style={styles.retryButton}
            onPress={() => setReloadKey((k) => k + 1)}
          >
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Seção 1 — Raio de visibilidade (liga ao domínio) ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Raio de visibilidade</Text>
              <Text style={styles.sectionSubtitle}>
                Distância máxima para clientes te encontrarem
              </Text>
            </View>

            <View style={styles.radiusCard}>
              <View style={styles.radiusTopRow}>
                <View style={styles.radiusCurrent}>
                  <Text style={styles.radiusLabel}>Raio atual</Text>
                  <Text style={styles.radiusValue} testID="radius-value">
                    {formatRadius(radiusKm)}
                  </Text>
                </View>
                {/* DECORATIVO: o domínio da fila não expõe contagem de clientes
                    por raio — valor estático (espelha o Figma). */}
                <Text style={styles.radiusClients}>3 clientes nessa área</Text>
              </View>

              <Slider
                value={radiusKm}
                min={0.5}
                max={10}
                step={0.5}
                onValueChange={setRadiusKm}
                accessibilityLabel="Raio de visibilidade em quilômetros"
                testID="radius-slider"
                style={styles.slider}
              />

              <View style={styles.rangeRow}>
                <Text style={styles.rangeLabel}>500 m</Text>
                <Text style={styles.rangeLabel}>10 km</Text>
              </View>
            </View>

            <View style={styles.presetsRow} testID="radius-presets">
              {RADIUS_PRESETS.map((km) => (
                <Chip
                  key={km}
                  label={`${km} km`}
                  selected={radiusKm === km}
                  onPress={() => setRadiusKm(km)}
                />
              ))}
            </View>
          </View>

          {/* ── Seção 2 — Serviços disponíveis (DECORATIVA, seleção local) ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Serviços disponíveis Aqui e Agora</Text>
              <Text style={styles.sectionSubtitle}>
                Selecione quais serviços você atende sob demanda
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.servicesRow}
            >
              {SERVICE_CATALOG.map((service, index) => {
                const selected = selectedServices.has(index);
                return (
                  <Pressable
                    key={service.title}
                    accessibilityRole="button"
                    accessibilityLabel={`Serviço ${service.title}, ${service.price}`}
                    accessibilityState={{ selected }}
                    testID={`service-card-${index}`}
                    style={[styles.serviceCard, !selected && styles.serviceCardDeselected]}
                    onPress={() => toggleService(index)}
                  >
                    {/* Bloco de cor DECORATIVO (sem asset remoto) com badge branco. */}
                    <View style={styles.serviceImage}>
                      <View style={styles.serviceBadge}>
                        <Text style={styles.serviceBadgeText}>Cabeleireiro</Text>
                      </View>
                    </View>
                    <Text style={styles.serviceTitle} numberOfLines={2}>
                      {service.title}
                    </Text>
                    <Text style={styles.servicePrice}>{service.price}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Seção 3 — Encerramento automático (liga ao domínio) ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Encerramento automático</Text>
              <Text style={styles.sectionSubtitle}>
                Após esse tempo, seu modo será desativado
              </Text>
            </View>

            <View style={styles.autoCloseRow} testID="autoclose-presets">
              {AUTOCLOSE_PRESETS.map((preset) => (
                <Chip
                  key={preset.label}
                  label={preset.label}
                  selected={autoCloseMinutes === preset.value}
                  onPress={() => setAutoCloseMinutes(preset.value)}
                />
              ))}
            </View>
          </View>

          {/* ── Salvar (persiste só os campos do domínio) ── */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Salvar configurações"
            accessibilityState={{ disabled: saving }}
            testID="btn-save"
            disabled={saving}
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Salvar configurações</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
};

export default MerchantAquiAgoraSettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  retryButton: {
    height: 44,
    borderRadius: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  retryText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.contentLight,
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
    rowGap: 16,
  },
  sectionHeader: {
    rowGap: 4,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  sectionSubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  // ── Raio de visibilidade ─────────────────────────────────
  radiusCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    borderRadius: 16,
    padding: 16,
    rowGap: 16,
  },
  radiusTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  radiusCurrent: {
    rowGap: 4,
  },
  radiusLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  radiusValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 32,
    color: colors.textPrimary,
  },
  radiusClients: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.accent,
    textAlign: 'right',
    flexShrink: 1,
  },
  slider: {
    alignSelf: 'stretch',
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // ── Serviços (decorativo) ────────────────────────────────
  servicesRow: {
    flexDirection: 'row',
    columnGap: 12,
    paddingRight: 4,
  },
  serviceCard: {
    width: 193,
    rowGap: 8,
  },
  serviceCardDeselected: {
    opacity: 0.5,
  },
  serviceImage: {
    height: 94,
    borderRadius: 8,
    backgroundColor: colors.surfaceGrey,
    padding: 8,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  serviceBadge: {
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  serviceBadgeText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 10,
    color: colors.textPrimary,
  },
  serviceTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  servicePrice: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.surfaceSuccess,
  },
  // ── Encerramento automático ──────────────────────────────
  autoCloseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
