import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

export type AppointmentDaySectionProps = {
  dateLabel: string;
  isToday?: boolean;
  statusLabel?: string;
  hasAppointments?: boolean;
  children: React.ReactNode;
  containerStyle?: ViewStyle;
};

const AppointmentDaySection: React.FC<AppointmentDaySectionProps> = ({
  dateLabel,
  isToday = false,
  statusLabel,
  hasAppointments = true,
  children,
  containerStyle,
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        <Text style={styles.dateText}>{dateLabel}</Text>
        {isToday && <Text style={styles.todayChip}>Hoje</Text>}
      </View>

      {statusLabel ? <Text style={styles.statusLabel}>{statusLabel}</Text> : null}

      {hasAppointments ? (
        <View style={styles.cardsWrapper}>{children}</View>
      ) : (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateText}>
            Você ainda não tem nenhum agendamento, agende um serviço para visualizar eles aqui:
          </Text>
        </View>
      )}

    </View>
  );
};

export default AppointmentDaySection;

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  todayChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E6F4EC',
    color: '#17723F',
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
  },
  statusLabel: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  cardsWrapper: {
    gap: 12,
  },
  emptyStateContainer: {
    backgroundColor: '#FEFEFE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBDBDB',
    borderStyle: 'dashed',
    padding: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
    lineHeight: 24,
  },
});

