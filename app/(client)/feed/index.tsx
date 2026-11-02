import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FeedScreen } from '../../../components/feed/FeedScreen';

/** "?businessId=102" vira 102; ausente ou inválido vira undefined (só o feed). */
function parseBusinessId(raw: string | string[] | undefined): number | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

/** Feed do cliente (F6). A StoriesRow da home abre com `businessId`. */
export default function ClientFeedRoute() {
  const { businessId } = useLocalSearchParams<{ businessId?: string }>();
  return <FeedScreen role="client" initialBusinessId={parseBusinessId(businessId)} />;
}
