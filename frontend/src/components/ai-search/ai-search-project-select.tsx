import type { ProjectSummary } from '@/types/domain';

type AiSearchProjectSelectProps = {
  projects: ProjectSummary[];
  selectedProjectId: string;
  isLoading?: boolean;
  onChange: (projectId: string) => void;
};

export const AiSearchProjectSelect = ({
  projects,
  selectedProjectId,
  isLoading = false,
  onChange
}: AiSearchProjectSelectProps) => {
  if (isLoading) {
    return (
      <div className="mt-3 rounded-lg border border-[#d8deeb] bg-white px-3 py-2 text-sm text-[#667085]">
        Carregando projetos...
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-[#d8deeb] bg-white px-3 py-2 text-sm text-[#667085]">
        Nenhum projeto disponível.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <select
        id="ai-search-project"
        value={selectedProjectId}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-[#cfd7e6] bg-white px-3 text-sm text-[#111827] outline-none transition-colors focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/15"
      >
        <option value="">Selecione um projeto</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
};
