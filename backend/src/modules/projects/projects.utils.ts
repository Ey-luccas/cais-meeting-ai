export const generateProjectKey = (name: string): string => {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 8);

  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${base || 'PRJ'}-${suffix}`;
};
