import { cn } from '@/lib/utils';

type FilterPillItem<T extends string | number> = {
  id: T;
  label: string;
};

type FilterPillsProps<T extends string | number> = {
  value: T;
  items: FilterPillItem<T>[];
  onChange: (value: T) => void;
  className?: string;
};

export const FilterPills = <T extends string | number>({ value, items, onChange, className }: FilterPillsProps<T>) => (
  <div className={cn('inline-flex rounded-[10px] border border-[#d8e0ee] bg-white p-1', className)}>
    {items.map((item) => (
      <button
        key={String(item.id)}
        type="button"
        onClick={() => onChange(item.id)}
        className={cn(
          'rounded-[8px] px-3 py-1.5 text-xs font-semibold transition-colors',
          value === item.id ? 'bg-[#eaf3ff] text-[#005eb8]' : 'text-[#64748b] hover:text-[#111827]'
        )}
      >
        {item.label}
      </button>
    ))}
  </div>
);
