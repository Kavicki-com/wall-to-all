import React from 'react';
import { router } from 'expo-router';
import { LegalDocumentScreen } from '../../../components/legal/LegalDocumentScreen';
import { PRIVACY_POLICY } from '../../../lib/legal-content';

const PrivacyScreen: React.FC = () => {
    return (
        <LegalDocumentScreen
            title="Política de Privacidade"
            content={PRIVACY_POLICY}
            onClose={() => router.replace('/(merchant)/settings')}
        />
    );
};

export default PrivacyScreen;
