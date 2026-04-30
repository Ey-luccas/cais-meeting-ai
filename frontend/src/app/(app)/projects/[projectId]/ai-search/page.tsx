'use client';

import { useParams } from 'next/navigation';

import { AiSearchPage } from '@/components/ai-search/ai-search-page';

export default function ProjectAiSearchPage() {
  const params = useParams<{ projectId: string }>();

  return <AiSearchPage projectId={params.projectId} />;
}
