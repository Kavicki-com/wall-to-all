import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IconBack, IconChevronDown } from '../../lib/icons';
import { colors } from '../../lib/theme';

export type MonthCalendarProps = {
  currentMonth: Date;
  onMonthChange: (direction: 'prev' | 'next') => void;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  markedDates?: string[];
  resetExpandedState?: boolean;
};

const TOTAL_CELLS = 42;

const generateCalendarDates = (month: Date) => {
  const startOfMonthDate = startOfMonth(month);
  const endOfMonthDate = endOfMonth(month);
  // Cabeçalho é Segunda-first (S,T,Q,Q,S,S,D), então o padding de dias do mês
  // anterior precisa ser contado a partir de Segunda: (getDay()+6)%7
  // (getDay(): 0=Domingo ... 6=Sábado).
  const startDay = (startOfMonthDate.getDay() + 6) % 7;
  const dates: Date[] = [];

  for (let i = startDay; i > 0; i--) {
    const prevDay = new Date(startOfMonthDate);
    prevDay.setDate(startOfMonthDate.getDate() - i);
    dates.push(prevDay);
  }

  const daysInMonth = eachDayOfInterval({
    start: startOfMonthDate,
    end: endOfMonthDate,
  });
  dates.push(...daysInMonth);

  const remainingCells = TOTAL_CELLS - dates.length;
  for (let i = 1; i <= remainingCells; i++) {
    const nextDay = new Date(endOfMonthDate);
    nextDay.setDate(endOfMonthDate.getDate() + i);
    dates.push(nextDay);
  }

  return dates;
};

export const MonthCalendar: React.FC<MonthCalendarProps> = ({
  currentMonth,
  onMonthChange,
  selectedDate,
  onSelectDate,
  markedDates = [],
  resetExpandedState = false,
}) => {
  const [showFullCalendar, setShowFullCalendar] = useState(false);

  // Resetar estado expandido quando resetExpandedState mudar
  useEffect(() => {
    if (resetExpandedState) {
      setShowFullCalendar(false);
    }
  }, [resetExpandedState]);

  const markedDatesSet = useMemo(() => new Set(markedDates), [markedDates]);
  const calendarDates = useMemo(() => generateCalendarDates(currentMonth), [currentMonth]);
  const weeks = useMemo(() => {
    const chunked: Date[][] = [];
    for (let i = 0; i < calendarDates.length; i += 7) {
      chunked.push(calendarDates.slice(i, i + 7));
    }
    return chunked;
  }, [calendarDates]);

  const collapsedWeek = useMemo(() => {
    if (!selectedDate) return weeks[0] || [];
    const targetWeek = weeks.find((week) =>
      week.some((d) => isSameDay(d, selectedDate)),
    );
    return targetWeek || weeks[0] || [];
  }, [selectedDate, weeks]);

  const handleDatePress = (date: Date) => {
    const monthDiff =
      (date.getFullYear() - currentMonth.getFullYear()) * 12 +
      (date.getMonth() - currentMonth.getMonth());

    if (monthDiff < 0) {
      onMonthChange('prev');
    } else if (monthDiff > 0) {
      onMonthChange('next');
    }

    onSelectDate(date);
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  return (
    <View style={styles.calendarContainer}>
      {showFullCalendar && (
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => onMonthChange('prev')}>
            <IconBack size={20} color={colors.brand} />
          </TouchableOpacity>
          <Text style={styles.monthYearText}>
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </Text>
          <TouchableOpacity onPress={() => onMonthChange('next')}>
            <IconBack size={20} color={colors.brand} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.daysOfWeekContainer}>
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((day, index) => (
          <Text key={`${day}-${index}`} style={styles.dayOfWeekText}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {(showFullCalendar ? weeks.flat() : collapsedWeek).map((date, index) => {
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          const isTodayDate = isToday(date);
          const hasAppointments = markedDatesSet.has(format(date, 'yyyy-MM-dd'));

          return (
            <TouchableOpacity
              key={`${date.toISOString()}-${index}`}
              style={[
                styles.calendarDay,
                !isCurrentMonth && styles.calendarDayInactive,
              ]}
              onPress={() => handleDatePress(date)}
              activeOpacity={0.9}
            >
              <View
                style={[
                  styles.dayInner,
                  isTodayDate && styles.dayInnerToday,
                  hasAppointments && !isTodayDate && styles.dayInnerHasAppointments,
                  isSelected && !isTodayDate && styles.dayInnerSelected,
                ]}
              >
                <Text
                  style={[
                    styles.calendarDayText,
                    !isCurrentMonth && styles.calendarDayTextInactive,
                    isSelected && !isTodayDate && styles.calendarDayTextSelected,
                  ]}
                >
                  {format(date, 'd')}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.toggleCalendarButton}
        onPress={() => setShowFullCalendar(!showFullCalendar)}
      >
        <Text style={styles.toggleCalendarButtonText}>
          {showFullCalendar ? 'Ocultar' : 'Ver tudo'}
        </Text>
        <IconChevronDown
          size={16}
          color={colors.brand}
          style={showFullCalendar ? { transform: [{ rotate: '180deg' }] } : undefined}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  calendarContainer: {
    backgroundColor: '#D6E0FF',
    borderRadius: 16,
    marginBottom: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  monthYearText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
    textTransform: 'capitalize',
    textAlign: 'center',
    flex: 1,
  },
  daysOfWeekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  dayOfWeekText: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  calendarDay: {
    width: '13.5%',
    alignItems: 'center',
    marginVertical: 4,
  },
  calendarDayInactive: {
    opacity: 0.38,
  },
  calendarDayText: {
    fontSize: 16,
    fontFamily: 'Montserrat_500Medium',
    color: colors.textPrimary,
  },
  calendarDayTextInactive: {
    color: '#919191',
  },
  calendarDayTextSelected: {
    color: colors.surface,
  },
  dayInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInnerToday: {
    borderWidth: 1.5,
    borderColor: '#17723F',
  },
  dayInnerHasAppointments: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  dayInnerSelected: {
    backgroundColor: colors.accent,
    borderRadius: 16,
  },
  toggleCalendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  toggleCalendarButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
    marginRight: 8,
  },
});

export default MonthCalendar;

