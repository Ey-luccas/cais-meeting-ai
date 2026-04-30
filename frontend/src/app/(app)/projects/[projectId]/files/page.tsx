import { redirect } from 'next/navigation';

type FilesRedirectPageProps = {
  params: {
    projectId: string;
  };
};

export default function FilesRedirectPage({ params }: FilesRedirectPageProps) {
  redirect(`/projects/${params.projectId}/library`);
}
