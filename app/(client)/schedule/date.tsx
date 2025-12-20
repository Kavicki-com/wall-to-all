import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { CustomButton } from '../../../components/CustomButton';
import MonthCalendar from '../../../components/calendar/MonthCalendar';
import { safeGoBack } from '../../../lib/router-utils';

const ScheduleDateScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessId: string; serviceId: string }>();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const loading = false;

  // Resetar seleção quando a tela é focada
  useFocusEffect(
    React.useCallback(() => {
      setSelectedDate(null);
      setCurrentMonth(new Date());
      return () => {
        // Cleanup ao desfocar
      };
    }, [])
  );

  // Verificar parâmetros e redirecionar se necessário (após o render inicial)
  React.useEffect(() => {
    if (!params.businessId || !params.serviceId) {
      // Usar replace para evitar adicionar ao histórico
      router.replace('/(client)/home' as never);
    }
  }, [params.businessId, params.serviceId]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setCurrentMonth(date);
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentMonth((prevMonth) => {
      const newMonth = new Date(prevMonth);
      newMonth.setMonth(prevMonth.getMonth() + (direction === 'next' ? 1 : -1));
      return newMonth;
    });
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
    <ScreenContainer 
      scroll={true}
      hasHeader={true}
      hasTabBar={true}
      backgroundColor="#FAFAFA"
      header={
        <AppHeader
          showBackButton={true}
          onPressBack={() => safeGoBack('/(client)/home')}
        />
      }
      footer={selectedDate ? (
        <View style={styles.footerContainer}>
          <CustomButton
            compact
            title="Continuar"
            onPress={handleContinue}
            isLoading={loading}
            disabled={loading}
            variant="red"
            accessibilityLabel="Continuar para seleção de horário"
            accessibilityHint="Toque para continuar e selecionar o horário do agendamento"
            accessibilityState={{ disabled: loading }}
          />
        </View>
      ) : undefined}
    >
      <Text style={styles.sectionTitle}>Escolha uma data</Text>

      <MonthCalendar
        currentMonth={currentMonth}
        onMonthChange={handleMonthChange}
        selectedDate={selectedDate}
        onSelectDate={handleDateSelect}
        markedDates={[]}
      />
    </ScreenContainer>
  );
};

export default ScheduleDateScreen;

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    marginBottom: 16,
  },
  footerContainer: {
    backgroundColor: 'transparent',
    paddingTop: 12,
  },
});




