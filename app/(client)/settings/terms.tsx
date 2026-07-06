import React from 'react';
import { router } from 'expo-router';
import { LegalDocumentScreen } from '../../../components/legal/LegalDocumentScreen';
import { TERMS_OF_USE } from '../../../lib/legal-content';

const TermsScreen: React.FC = () => {
  return (
    <LegalDocumentScreen
      title="Termos de uso Wall to All"
      content={TERMS_OF_USE}
      onClose={() => router.replace('/(client)/settings')}
    />
  );
};

export default TermsScreen;




















