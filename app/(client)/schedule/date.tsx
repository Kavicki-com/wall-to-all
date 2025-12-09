import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MerchantTopBar } from '../../../components/MerchantTopBar';

const ScheduleDateScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessId: string; serviceId: string }>();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  // Resetar seleção quando a tela é focada
  useFocusEffect(
    React.useCallback(() => {
      setSelectedDate(null);
      return () => {
        // Cleanup ao desfocar
      };
    }, [])
  );

  // Gerar próximos 30 dias
  const generateDates = () => {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }

    return dates;
  };

  const dates = generateDates();

  const formatDate = (date: Date) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const months = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];

    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];

    return { dayName, day, month };
  };

  const isToday = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate.getTime() === today.getTime();
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleContinue = () => {
    if (selectedDate && params.businessId && params.serviceId) {
      const dateString = selectedDate.toISOString().split('T')[0];
      router.push({
        pathname: '/(client)/schedule/time',
        params: {
          businessId: params.businessId,
          serviceId: params.serviceId,
          date: dateString,
        },
      });
    }
  };

  return (
    <View style={styles.container}>
      <MerchantTopBar
        showBack
        onBackPress={() => router.back()}
        fallbackPath="/(client)/home"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Escolha uma data</Text>

        <View style={styles.datesContainer}>
          {dates.map((date, index) => {
            const { dayName, day, month } = formatDate(date);
            const isSelected = selectedDate?.getTime() === date.getTime();
            const isTodayDate = isToday(date);

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateCard,
                  isSelected && styles.dateCardSelected,
                  isTodayDate && styles.dateCardToday,
                ]}
                activeOpacity={0.8}
                onPress={() => handleDateSelect(date)}
                accessibilityRole="button"
                accessibilityLabel={`${dayName}, ${day} de ${month}${isTodayDate ? ', hoje' : ''}`}
                accessibilityHint={isSelected ? "Data selecionada. Toque novamente para desmarcar" : "Toque para selecionar esta data"}
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.dateDayName,
                    isSelected && styles.dateDayNameSelected,
                  ]}
                >
                  {dayName}
                </Text>
                <Text
                  style={[
                    styles.dateDay,
                    isSelected && styles.dateDaySelected,
                  ]}
                >
                  {day}
                </Text>
                <Text
                  style={[
                    styles.dateMonth,
                    isSelected && styles.dateMonthSelected,
                  ]}
                >
                  {month}
                </Text>
                {isTodayDate && (
                  <View style={styles.todayIndicator} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Continue Button */}
      {selectedDate && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueButton}
            activeOpacity={0.8}
            onPress={handleContinue}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Continuar para seleção de horário"
            accessibilityHint="Toque para continuar e selecionar o horário do agendamento"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FEFEFE" />
            ) : (
              <Text style={styles.continueButtonText}>Continuar</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default ScheduleDateScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    marginBottom: 16,
  },
  datesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dateCard: {
    width: 80,
    height: 100,
    backgroundColor: '#FEFEFE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  dateCardSelected: {
    backgroundColor: '#E5102E',
    borderColor: '#E5102E',
  },
  dateCardToday: {
    borderColor: '#000E3D',
    borderWidth: 2,
  },
  dateDayName: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
    marginBottom: 4,
  },
  dateDayNameSelected: {
    color: '#FEFEFE',
  },
  dateDay: {
    fontSize: 24,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    marginBottom: 4,
  },
  dateDaySelected: {
    color: '#FEFEFE',
  },
  dateMonth: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
  },
  dateMonthSelected: {
    color: '#FEFEFE',
  },
  todayIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5102E',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FEFEFE',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  continueButton: {
    backgroundColor: '#E5102E',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
});




