import { useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../../context/AuthContext';
import {
    DbReferralCode,
    ReferralWithDetails,
    CommissionSummary,
    DbReferralSettings
} from '../types';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { logger } from '../logger';

export function useReferral() {
    const { session } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [referralCode, setReferralCode] = useState<DbReferralCode | null>(null);
    const [referrals, setReferrals] = useState<ReferralWithDetails[]>([]);
    const [commissionSummary, setCommissionSummary] = useState<CommissionSummary>({
        totalEarned: 0,
        availableBalance: 0,
        pendingBalance: 0,
        referralCount: 0,
        paidAmount: 0,
    });
    const [settings, setSettings] = useState<DbReferralSettings | null>(null);

    // Buscar configurações globais
    const fetchSettings = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('referral_settings')
                .select('*')
                .single();

            if (error) throw error;
            setSettings(data);
            return data;
        } catch (error) {
            logger.error('Erro ao buscar configurações de referral:', error);
            return null;
        }
    }, []);

    // Função auxiliar para gerar código aleatório
    const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    // Buscar código de referral (com auto-geração para usuários antigos)
    const fetchReferralCode = useCallback(async () => {
        if (!session?.user?.id) return null;

        try {
            setIsLoading(true);

            // 1. Tentar buscar existente
            const { data, error } = await supabase
                .from('referral_codes')
                .select('*')
                .eq('user_id', session.user.id)
                .single();

            if (data) {
                setReferralCode(data);
                return data;
            }

            // 2. Se não existir, criar um novo
            if (error && error.code === 'PGRST116') { // Não encontrado
                let retries = 3;
                while (retries > 0) {
                    const newCode = generateCode();

                    const { data: newData, error: createError } = await supabase
                        .from('referral_codes')
                        .insert({
                            user_id: session.user.id,
                            code: newCode,
                            is_active: true
                        })
                        .select()
                        .single();

                    if (newData) {
                        setReferralCode(newData);

                        // Atualizar profile também com o ID
                        await supabase
                            .from('profiles')
                            .update({ referral_code_id: newData.id })
                            .eq('id', session.user.id);

                        return newData;
                    }

                    // Se erro for duplicidade de código, tenta de novo
                    if (createError?.code === '23505') { // Unique violation
                        retries--;
                        continue;
                    }

                    // Outro erro
                    logger.error('Erro ao criar código de referral:', createError);
                    break;
                }
            } else if (error) {
                logger.error('Erro ao buscar código de referral:', error);
            }

            return null;
        } catch (error) {
            logger.error('Erro no fetchReferralCode:', error);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [session?.user?.id]);

    // Buscar histórico de indicações e comissões
    const fetchReferralsAndCommissions = useCallback(async () => {
        if (!session?.user?.id) return;

        try {
            setIsLoading(true);

            // 1. Buscar referrals (sem join por enquanto para evitar erro de FK inexistente)
            const { data: referralsData, error: referralError } = await supabase
                .from('referrals')
                .select('*')
                .eq('referrer_id', session.user.id)
                .order('created_at', { ascending: false });

            if (referralError) throw referralError;

            // 1.5 Buscar perfis dos indicados manualmente
            let formattedReferrals: ReferralWithDetails[] = [];

            if (referralsData && referralsData.length > 0) {
                const referredIds = referralsData.map(r => r.referred_id);

                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .in('id', referredIds);

                if (profilesError) {
                    logger.error('Erro ao buscar perfis dos indicados:', profilesError);
                    // Continua sem os dados de perfil se der erro
                }

                // Mapa para acesso rápido
                const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

                formattedReferrals = referralsData.map(ref => ({
                    ...ref,
                    referred: profilesMap.get(ref.referred_id) || { full_name: 'Usuário', avatar_url: null }
                })) as ReferralWithDetails[];
            } else {
                formattedReferrals = [];
            }

            setReferrals(formattedReferrals);

            // 2. Buscar comissões
            const { data: commissionsData, error: commissionError } = await supabase
                .from('commissions')
                .select('*')
                .eq('referrer_id', session.user.id);

            if (commissionError) throw commissionError;

            // Calcular sumário
            const summary = (commissionsData || []).reduce(
                (acc, curr) => {
                    const amount = Number(curr.amount);

                    acc.totalEarned += amount;

                    if (curr.status === 'available') {
                        acc.availableBalance += amount;
                    } else if (curr.status === 'pending') {
                        acc.pendingBalance += amount;
                    } else if (curr.status === 'paid') {
                        acc.paidAmount += amount;
                    }

                    return acc;
                },
                {
                    totalEarned: 0,
                    availableBalance: 0,
                    pendingBalance: 0,
                    referralCount: formattedReferrals.length,
                    paidAmount: 0
                } as CommissionSummary
            );

            setCommissionSummary(summary);

        } catch (error) {
            logger.error('Erro ao buscar dados de referral:', error);
        } finally {
            setIsLoading(false);
        }
    }, [session?.user?.id]);

    // Gerar link de indicação
    const getReferralLink = useCallback((code: string) => {
        // Em produção (ou build nativa), queremos o esquema fixo walltoall://
        // No Expo Go (desenvolvimento), precisamos do exp://IP... para funcionar

        // Se estivermos em dev e usando Expo Go, deixamos o Linking gerenciar (vai usar IP)
        // Se quisermos simular o link final:
        // return `walltoall://signup?ref=${code}`;

        const deepLink = Linking.createURL('signup', {
            queryParams: { ref: code },
            scheme: 'walltoall'
        });

        return deepLink;
    }, []);

    // Copiar link para área de transferência
    const copyReferralLink = useCallback(async (code: string) => {
        const link = getReferralLink(code);
        await Clipboard.setStringAsync(link);
        return link;
    }, [getReferralLink]);

    return {
        isLoading,
        referralCode,
        referrals,
        commissionSummary,
        settings,
        fetchSettings,
        fetchReferralCode,
        fetchReferralsAndCommissions,
        getReferralLink,
        copyReferralLink
    };
}
