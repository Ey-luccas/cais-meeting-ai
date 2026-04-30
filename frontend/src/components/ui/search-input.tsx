import { Search } from 'lucide-react';

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export const SearchInput = ({ value, onChange, placeholder = 'Buscar...' }: SearchInputProps) => (
  <div className="relative">
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-[10px] border border-app bg-white pl-10 pr-3 text-sm text-[#111827] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
    />
  </div>
);
