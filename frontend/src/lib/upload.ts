const DEFAULT_MAX_FILE_SIZE_MB = 25;

const parseMaxFileSizeMb = (): number => {
  const rawValue = process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB;
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_FILE_SIZE_MB;
  }

  return parsed;
};

export const MAX_UPLOAD_FILE_SIZE_MB = parseMaxFileSizeMb();
export const MAX_UPLOAD_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;

export const isFileTooLarge = (file: File): boolean => {
  return file.size > MAX_UPLOAD_FILE_SIZE_BYTES;
};
