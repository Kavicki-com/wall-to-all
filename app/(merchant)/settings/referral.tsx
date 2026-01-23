import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import ReferralDashboard from '../../../components/referral/ReferralDashboard';

const MerchantReferralScreen: React.FC = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const Header = () => (
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                activeOpacity={0.7}
            >
                <MaterialIcons name="chevron-left" size={28} color="#000E3D" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Indicações</Text>
            <View style={styles.placeholder} />
        </View>
    );

    return (
        <ScreenContainer
            scroll={false}
            backgroundColor="#F9FAFB"
            header={<Header />}
        >
            <View style={{ flex: 1 }}>
                <ReferralDashboard userType="merchant" />
            </View>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FAFAFA',
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontFamily: 'Montserrat_700Bold',
        fontSize: 18,
        color: '#000E3D',
    },
    placeholder: {
        width: 44,
    },
});

export default MerchantReferralScreen;
