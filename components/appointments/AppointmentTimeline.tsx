import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { colors } from '../../lib/theme';

export interface TimelineEvent {
    id: string;
    type: 'creation' | 'confirmed' | 'reschedule_request' | 'reschedule_accepted' | 'reschedule_rejected' | 'cancellation' | 'completion';
    date: string;
    title: string;
    description?: string;
    actor: 'client' | 'merchant' | 'system';
}

interface AppointmentTimelineProps {
    events: TimelineEvent[];
    /** Rótulo exibido para "merchant". Padrão: "Profissional" */
    merchantLabel?: string;
    /** Rótulo exibido para "client". Padrão: "Você" */
    clientLabel?: string;
}

/**
 * Componente reutilizável de timeline de agendamento.
 * Usado tanto na tela de detalhe do cliente quanto do merchant.
 */
export const AppointmentTimeline: React.FC<AppointmentTimelineProps> = ({
    events,
    merchantLabel = 'Profissional',
    clientLabel = 'Você',
}) => {
    if (events.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Histórico do Agendamento</Text>
            <View style={styles.container}>
                {events.map((event, index, array) => (
                    <View key={event.id} style={styles.item}>
                        <View style={styles.leftColumn}>
                            <View style={[
                                styles.dot,
                                event.type === 'creation' && styles.dotCreation,
                                event.type === 'confirmed' && styles.dotConfirmed,
                                event.type === 'reschedule_accepted' && styles.dotSuccess,
                                event.type === 'reschedule_rejected' && styles.dotError,
                            ]} />
                            {index !== array.length - 1 && <View style={styles.line} />}
                        </View>
                        <View style={styles.content}>
                            <View style={styles.header}>
                                <Text style={styles.title}>{event.title}</Text>
                                <Text style={styles.date}>
                                    {format(new Date(event.date), "dd/MM HH:mm", { locale: ptBR })}
                                </Text>
                            </View>
                            {event.description && (
                                <Text style={styles.description}>{event.description}</Text>
                            )}
                            <Text style={styles.actor}>
                                {event.actor === 'merchant' ? merchantLabel : event.actor === 'client' ? clientLabel : 'Sistema'}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginVertical: 4,
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Montserrat_700Bold',
        color: '#333',
        marginBottom: 16,
    },
    container: {
        paddingLeft: 4,
    },
    item: {
        flexDirection: 'row',
        minHeight: 60,
    },
    leftColumn: {
        width: 24,
        alignItems: 'center',
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#CCC',
        marginTop: 4,
    },
    dotCreation: {
        backgroundColor: colors.brand,
    },
    dotConfirmed: {
        backgroundColor: colors.success,
    },
    dotSuccess: {
        backgroundColor: colors.success,
    },
    dotError: {
        backgroundColor: colors.accent,
    },
    line: {
        width: 2,
        flex: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: 4,
    },
    content: {
        flex: 1,
        paddingBottom: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 14,
        fontFamily: 'Montserrat_700Bold',
        color: '#333',
    },
    date: {
        fontSize: 12,
        fontFamily: 'Montserrat_400Regular',
        color: '#999',
    },
    description: {
        fontSize: 13,
        fontFamily: 'Montserrat_400Regular',
        color: '#666',
        marginTop: 2,
    },
    actor: {
        fontSize: 12,
        fontFamily: 'Montserrat_400Regular',
        color: '#999',
        marginTop: 4,
    },
});
