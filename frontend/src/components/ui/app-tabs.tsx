import { cn } from '@/lib/utils';

type AppTabItem<T extends string> = {
  id: T;
  label: string;
};

type AppTabsProps<T extends string> = {
  value: T;
  items: AppTabItem<T>[];
  onChange: (value: T) => void;
  className?: string;
};

export const AppTabs = <T extends string>({ value, items, onChange, className }: AppTabsProps<T>) => (
  <div className={cn('inline-flex rounded-[10px] border border-[#d8e0ee] bg-white p-1', className)}>
    {items.map((item) => (
      <button
        key={item.id}
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
