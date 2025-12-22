import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
// Certifique-se que o caminho dos ícones está correto no seu projeto
import { IconPix, IconCreditCard, IconCash } from '../lib/icons'; 
import { formatWorkDays } from '../lib/workDaysUtils';

export type BusinessCardProps = {
  id: string;
  business_name: string;
  logo_url: string | null;
  banner_url?: string | null;
  description?: string | null;
  category?: string | null;
  accepted_payment_methods?: {
    pix?: boolean;
    card?: boolean;
    cash?: boolean;
  } | null;
  work_days?: Record<string, { start: string; end: string }> | null;
  services?: Array<{ id: string; name: string; price?: number }>;
  categories?: {
    id: number;
    name: string;
  } | null;
  width?: number;
  onPress?: (id: string) => void;
};

/**
 * Lógica de Preço Atualizada conforme solicitação:
 * 1 cifrão ($)   : até R$ 30,00
 * 2 cifrões ($$) : até R$ 50,00 (e intervalo vago até 100)
 * 3 cifrões ($$$): acima de R$ 100,00
 * 4 cifrões ($$$$): acima de R$ 200,00
 * 5 cifrões ($$$$$): acima de R$ 300,00
 */
import { getPriceLevel } from '../lib/utils';

export const BusinessCard: React.FC<BusinessCardProps> = ({
  id,
  business_name,
  logo_url,
  banner_url,
  description,
  category,
  accepted_payment_methods,
  work_days,
  services = [],
  categories,
  width,
  onPress,
}) => {
  const router = useRouter();
  const paymentMethods = accepted_payment_methods || {};
  const businessServices = services || [];
  
  // Calcula o nível de preço (1 a 5) e garante que seja válido
  const priceLevel = Math.max(1, Math.min(5, getPriceLevel(businessServices)));
  const fullPriceString = "$$$$$";

  const handlePress = () => {
    if (onPress) {
      onPress(id);
    } else {
      router.push(`/(client)/store/${id}`);
    }
  };

  // Garantir que business_name sempre seja uma string válida
  const safeBusinessName = String(business_name || '');
  
  // Prioridade de descrição: Descrição do banco > Nome da Categoria > Texto padrão
  const displaySubtitle = String(description || categories?.name || category || 'Serviços especializados');

  return (
    <View style={styles.cardWrapper}>
      <TouchableOpacity
        style={[styles.businessCard, width ? { width } : { width: 255 }]}
        activeOpacity={0.9}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Loja ${safeBusinessName}`}
      >
      {/* --- HERO SECTION (Banner) --- */}
      <View style={styles.businessHeroContainer}>
        {/* Imagem de Fundo */}
        {banner_url && banner_url.trim() !== '' ? (
          <Image
            source={{ uri: banner_url }}
            style={styles.businessHeroImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.businessHeroImage, styles.placeholderImage]} />
        )}

        {/* Gradiente para leitura do texto (Corrigido para a cor do Figma) */}
        <LinearGradient
          colors={['transparent', 'rgba(0, 14, 61, 0.5)']} 
          style={styles.businessGradient}
        />

        {/* Container que segura Logo + Texto dentro do Banner - POSIÇÃO ORIGINAL MANTIDA */}
        <View style={styles.headerContentRow}>
            {/* Logo Circular */}
            <View style={styles.businessAvatarContainer}>
              {logo_url ? (
                <Image
                  source={{ uri: logo_url }}
                  style={styles.businessAvatar}
                />
              ) : (
                <View style={[styles.businessAvatar, styles.placeholderAvatar]} />
              )}
            </View>

            {/* Texto ao lado do Logo */}
            <View style={styles.headerTextContainer}>
                <Text style={styles.businessName} numberOfLines={1}>
                  {safeBusinessName}
                </Text>
                <Text style={styles.businessDescription} numberOfLines={1}>
                  {String(displaySubtitle || '')}
                </Text>
            </View>
        </View>
      </View>

      {/* --- BODY SECTION --- */}
      {/* cardBody com PADDING de 16px para criar a borda branca (Conforme Figma) */}
      <View style={styles.cardBody}>
        
        {/* Linha de Preço Médio */}
        <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Preço médio</Text>
            <View style={styles.priceValueContainer}>
                {/* Cifrões Ativos (Vermelho/Rosa) */}
                <Text style={styles.priceActive}>
                    {fullPriceString.substring(0, Math.max(0, Math.min(priceLevel, fullPriceString.length)))}
                </Text>
                {/* Cifrões Inativos (Cinza) */}
                <Text style={styles.priceInactive}>
                    {fullPriceString.substring(Math.max(0, Math.min(priceLevel, fullPriceString.length)))}
                </Text>
            </View>
        </View>

        {/* Tags de Serviços (Scroll Horizontal) */}
        {businessServices.length > 0 && (
          <View style={styles.pillsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.servicePillsContainer}
            >
              {businessServices.slice(0, 5).map((service, index) => (
                <View key={service.id || `service-${index}`} style={styles.servicePill}>
                  <Text style={styles.servicePillText} numberOfLines={1}>
                    {service.name || ''}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Horário de Funcionamento */}
        <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Horário de funcionamento</Text>
            <Text style={styles.infoText}>
                {String(formatWorkDays(work_days || null) || 'Não informado')}
            </Text>
        </View>

        {/* Pagamentos Aceitos */}
        <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Pagamentos aceitos</Text>
            <View style={styles.paymentMethodsRow}>
                {paymentMethods.pix && (
                <View style={styles.paymentBadge}>
                    <IconPix width={16} height={16} color="#000E3D" />
                    <Text style={styles.paymentText}>PIX</Text>
                </View>
                )}
                {paymentMethods.card && (
                <View style={styles.paymentBadge}>
                    <IconCreditCard width={16} height={16} color="#000E3D" />
                    <Text style={styles.paymentText}>Cartão</Text>
                </View>
                )}
                {paymentMethods.cash && (
                <View style={styles.paymentBadge}>
                    <IconCash width={16} height={16} color="#000E3D" />
                    <Text style={styles.paymentText}>Dinheiro</Text>
                </View>
                )}
            </View>
        </View>

      </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    // REMOVER padding, backgroundColor e marginBottom daqui
    // Esses estilos devem estar apenas no businessCard
  },
  businessCard: {
    width: 255,
    backgroundColor: '#FFFFFF', // Mudar de #FEFEFE para #FFFFFF
    borderRadius: 16,
    // ADICIONAR aqui: padding, shadow, marginBottom
    padding: 0, // Sem padding interno, será controlado pelo cardBody
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
    overflow: 'hidden', // Importante para o borderRadius funcionar
  },
  
  // --- HEADER / HERO STYLES ---
  businessHeroContainer: {
    height: 122,
    width: '100%',
    position: 'relative',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    // REMOVER borderBottomLeftRadius e borderBottomRightRadius
    overflow: 'hidden',
  },
  businessHeroImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: '#333',
  },
  businessGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%', 
  },
  
  // Layout do Header: Logo + Texto alinhados na base (POSIÇÃO ORIGINAL MANTIDA)
  headerContentRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 8, // Espaçamento interno menor para alinhar com o design
    flexDirection: 'row',
    alignItems: 'flex-end', 
  },
  
  // Avatar / Logo
  businessAvatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28, // Circular
    borderWidth: 2,
    borderColor: '#E5102E', // Cor da borda alterada para o vermelho/rosa do design
    backgroundColor: '#FFF',
    marginRight: 8, // Espaçamento entre logo e texto (Figma: 8)
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  businessAvatar: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderAvatar: {
    backgroundColor: '#E1E1E1',
  },

  // Texto do Header
  headerTextContainer: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: 8, // Alinhamento com a base do avatar
  },
  businessName: {
    fontSize: 16, 
    fontFamily: 'Montserrat_700Bold', 
    color: '#FEFEFE', 
    marginBottom: 4, 
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  businessDescription: {
    fontSize: 8, 
    fontFamily: 'Montserrat_500Medium', 
    color: '#FEFEFE',
    opacity: 0.9,
  },

  // --- BODY STYLES ---
  cardBody: {
    padding: 16, // Manter padding de 16px
    paddingTop: 8, // Manter paddingTop reduzido
    backgroundColor: '#FEFEFE', // Manter fundo branco do corpo
    // REMOVER borderBottomLeftRadius e borderBottomRightRadius daqui
    // O borderRadius já está no businessCard
  },
  
  // Preço
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8, // Espaçamento para o pills wrapper
  },
  priceLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  priceValueContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  priceActive: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E', 
    letterSpacing: 2,
  },
  priceInactive: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#DBDBDB', 
    letterSpacing: 2,
  },

  // Pills (Tags)
  pillsWrapper: {
    marginBottom: 8,
  },
  servicePillsContainer: {
    paddingRight: 4, // Adicionar um paddingRight para dar espaço após a última pílula
    gap: 4, // Espaçamento entre as tags
  },
  servicePill: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 32, 
    paddingHorizontal: 8, 
    paddingVertical: 8, 
    backgroundColor: 'transparent',
    flexShrink: 0, // Garante que a pílula não vai encolher
  },
  servicePillText: {
    fontSize: 12, 
    fontFamily: 'Montserrat_500Medium', 
    color: '#000E3D',
  },

  // Seções de Info
  infoSection: {
    paddingVertical: 8, // Espaçamento vertical entre as seções
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    marginBottom: 8, 
  },
  infoText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  
  // Pagamentos
  paymentMethodsRow: {
    flexDirection: 'row',
    gap: 16, 
    // Corrigido para NÃO USAR flexWrap: 'wrap', forçando a linha horizontal
    flexWrap: 'nowrap', 
    alignItems: 'center',
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Espaçamento entre ícone e texto
    flexShrink: 0, // Garante que o badge não encolha
  },
  paymentText: {
    fontSize: 12, 
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F', 
  },
});