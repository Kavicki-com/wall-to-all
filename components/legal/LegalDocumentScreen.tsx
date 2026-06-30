import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { CustomButton } from '../CustomButton';
import { colors } from '../../lib/theme';

interface LegalDocumentScreenProps {
    title: string;
    content: string;
    onClose: () => void;
}

export const LegalDocumentScreen: React.FC<LegalDocumentScreenProps> = ({
    title,
    content,
    onClose,
}) => {
    return (
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{title}</Text>
                <View style={styles.scrollContainer}>
                    <ScrollView
                        style={styles.contentScroll}
                        contentContainerStyle={styles.contentContainer}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                    >
                        <Text style={styles.contentText}>{content}</Text>
                    </ScrollView>
                </View>
                <CustomButton
                    title="Fechar"
                    variant="outline"
                    onPress={onClose}
                    style={styles.closeButton}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 16,
        width: '100%',
        maxWidth: 342,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        color: colors.accent,
        textAlign: 'center',
        marginBottom: 16,
    },
    scrollContainer: {
        height: 400,
        marginBottom: 16,
    },
    contentScroll: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 8,
    },
    contentText: {
        fontSize: 12,
        fontFamily: 'Montserrat_400Regular',
        color: '#000000',
        lineHeight: 18,
    },
    closeButton: {
        borderRadius: 24,
        width: 256,
        alignSelf: 'center',
    },
});
