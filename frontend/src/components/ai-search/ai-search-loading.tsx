export const AiSearchLoading = ({ label = 'A IA está analisando as fontes…' }: { label?: string }) => {
  return (
    <div className="rounded-xl border border-[#c2c6d4]/50 bg-white px-4 py-3 text-sm text-[#424752] shadow-[0_8px_26px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#00478d]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#00478d]/70 [animation-delay:140ms]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#00478d]/40 [animation-delay:280ms]" />
        <span className="ml-2">{label}</span>
      </div>
    </div>
  );
};
