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
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'date.tsx:22',message:'useFocusEffect - resetando seleção',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      setSelectedDate(null);
      setCurrentMonth(new Date());
      return () => {
        // Cleanup ao desfocar
      };
    }, [])
  );
  
  // #region agent log
  React.useEffect(() => {
    fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'date.tsx:32',message:'selectedDate mudou',data:{selectedDateISO:selectedDate?.toISOString(),currentMonthISO:currentMonth.toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  }, [selectedDate, currentMonth]);
  // #endregion

  // Verificar parâmetros e redirecionar se necessário (após o render inicial)
  React.useEffect(() => {
    if (!params.businessId || !params.serviceId) {
      // Usar replace para evitar adicionar ao histórico
      router.replace('/(client)/home' as never);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // router é estável do expo-router, não precisa estar nas dependências
  }, [params.businessId, params.serviceId]);

  const handleDateSelect = (date: Date) => {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'date.tsx:51',message:'handleDateSelect chamado - copiado do merchant',data:{dateISO:date.toISOString(),dateString:date.toISOString().split('T')[0],previousSelectedDateISO:selectedDate?.toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'MERCHANT'})}).catch(()=>{});
    // #endregion
    // Copiado do merchant: apenas atualizar selectedDate, sem atualizar currentMonth
    setSelectedDate(date);
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'date.tsx:56',message:'handleDateSelect - apenas selectedDate atualizado',data:{dateISO:date.toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'MERCHANT'})}).catch(()=>{});
    // #endregion
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




