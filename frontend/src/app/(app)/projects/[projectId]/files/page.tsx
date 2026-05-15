'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function FilesRedirectPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;

  useEffect(() => {
    if (projectId) {
      router.replace(`/projects/${projectId}/library`);
    }
  }, [projectId, router]);

  return null;
}
