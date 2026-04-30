import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { storageDirectories } from '../../shared/storage';
import { AppError } from '../../shared/app-error';

const MAX_CHUNK_SIZE_BYTES = 25 * 1024 * 1024;
const TARGET_CHUNK_DURATION_SECONDS = 9 * 60;
const MIN_CHUNK_DURATION_SECONDS = 90;
const CHUNK_REENCODE_BITRATE = '96k';
const CHUNK_SAMPLE_RATE = 16000;
const TEMP_DIR_PREFIX = 'transcription-';
const MAX_SPLIT_ATTEMPTS = 6;

type ProbeFormatJson = {
  format?: {
    duration?: string;
    size?: string;
  };
};

type AudioProbe = {
  durationSeconds: number;
  sizeBytes: number;
};

export type AudioChunk = {
  index: number;
  filePath: string;
  startSeconds: number;
  durationSeconds: number;
  sizeBytes: number;
};

export type AudioChunkSplitResult = {
  tempDirectoryPath: string;
  sourceDurationSeconds: number | null;
  chunks: AudioChunk[];
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'unknown_error';
};

const parsePositiveNumber = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const parseChunkIndex = (fileName: string): number | null => {
  const matched = fileName.match(/^chunk_(\d+)\.mp3$/);

  if (!matched) {
    return null;
  }

  return Number.parseInt(matched[1], 10);
};

export class AudioProcessingService {
  async splitAudioChunks(filePath: string): Promise<AudioChunkSplitResult> {
    try {
      await access(filePath);
    } catch {
      throw new AppError(400, 'Arquivo de áudio não encontrado para processamento.');
    }

    const probe = await this.probeAudio(filePath);
    const tempDirectoryPath = await this.createTemporaryDirectory();

    try {
      const chunkDurationSeconds = await this.generateChunkFilesUntilValid({
        filePath,
        tempDirectoryPath
      });

      const chunks = await this.buildChunkMetadata(tempDirectoryPath, chunkDurationSeconds);

      if (chunks.length === 0) {
        throw new AppError(500, 'Não foi possível gerar chunks de áudio para transcrição.');
      }

      return {
        tempDirectoryPath,
        sourceDurationSeconds: probe.durationSeconds,
        chunks
      };
    } catch (error) {
      await this.cleanupTemporaryFiles(tempDirectoryPath);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(500, 'Falha ao dividir áudio em chunks.', {
        cause: toErrorMessage(error)
      });
    }
  }

  async cleanupTemporaryFiles(tempDirectoryPath: string): Promise<void> {
    await rm(tempDirectoryPath, { recursive: true, force: true });
  }

  private async createTemporaryDirectory(): Promise<string> {
    const tempRoot = path.join(storageDirectories.root, 'tmp');
    await mkdir(tempRoot, { recursive: true });
    return mkdtemp(path.join(tempRoot, TEMP_DIR_PREFIX));
  }

  private async probeAudio(filePath: string): Promise<AudioProbe> {
    const result = await this.runCommand('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration,size',
      '-of',
      'json',
      filePath
    ]);

    let json: ProbeFormatJson;

    try {
      json = JSON.parse(result.stdout) as ProbeFormatJson;
    } catch {
      throw new AppError(500, 'Falha ao ler metadados do áudio via ffprobe.');
    }

    const durationSeconds = parsePositiveNumber(json.format?.duration);
    const sizeBytes = parsePositiveNumber(json.format?.size);

    if (!durationSeconds || !sizeBytes) {
      throw new AppError(400, 'Não foi possível identificar duração e tamanho do áudio informado.');
    }

    return {
      durationSeconds,
      sizeBytes
    };
  }

  private async probeAudioDurationSeconds(filePath: string): Promise<number> {
    const result = await this.runCommand('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      filePath
    ]);

    let json: ProbeFormatJson;

    try {
      json = JSON.parse(result.stdout) as ProbeFormatJson;
    } catch {
      throw new AppError(500, 'Falha ao medir duração do chunk via ffprobe.');
    }

    const durationSeconds = parsePositiveNumber(json.format?.duration);

    if (!durationSeconds) {
      throw new AppError(500, 'Duração inválida encontrada em chunk de áudio.');
    }

    return durationSeconds;
  }

  private async generateChunkFilesUntilValid(input: {
    filePath: string;
    tempDirectoryPath: string;
  }): Promise<number> {
    let segmentDuration = TARGET_CHUNK_DURATION_SECONDS;

    for (let attempt = 0; attempt < MAX_SPLIT_ATTEMPTS; attempt += 1) {
      await this.clearChunkFiles(input.tempDirectoryPath);
      await this.runFfmpegSplit({
        filePath: input.filePath,
        tempDirectoryPath: input.tempDirectoryPath,
        segmentDurationSeconds: segmentDuration
      });

      const chunkFiles = await this.listChunkFilePaths(input.tempDirectoryPath);

      if (chunkFiles.length === 0) {
        throw new AppError(500, 'Nenhum chunk foi produzido pelo ffmpeg.');
      }

      const oversized = await this.findOversizedChunk(chunkFiles);

      if (!oversized) {
        return segmentDuration;
      }

      if (segmentDuration <= MIN_CHUNK_DURATION_SECONDS) {
        throw new AppError(
          400,
          'Não foi possível manter os chunks abaixo de 25MB mesmo após reduzir a duração.',
          {
            chunkPath: oversized.filePath,
            chunkSizeBytes: oversized.sizeBytes
          }
        );
      }

      segmentDuration = Math.max(MIN_CHUNK_DURATION_SECONDS, Math.floor(segmentDuration * 0.75));
    }

    throw new AppError(500, 'Falha ao gerar chunks válidos dentro do limite de tentativas.');
  }

  private async runFfmpegSplit(input: {
    filePath: string;
    tempDirectoryPath: string;
    segmentDurationSeconds: number;
  }): Promise<void> {
    const outputPattern = path.join(input.tempDirectoryPath, 'chunk_%04d.mp3');

    try {
      await this.runCommand('ffmpeg', [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        input.filePath,
        '-map',
        '0:a:0',
        '-vn',
        '-ac',
        '1',
        '-ar',
        String(CHUNK_SAMPLE_RATE),
        '-c:a',
        'libmp3lame',
        '-b:a',
        CHUNK_REENCODE_BITRATE,
        '-f',
        'segment',
        '-segment_time',
        String(input.segmentDurationSeconds),
        '-reset_timestamps',
        '1',
        outputPattern
      ]);
    } catch (error) {
      throw new AppError(500, 'Falha ao dividir áudio com ffmpeg.', {
        cause: toErrorMessage(error)
      });
    }
  }

  private async clearChunkFiles(tempDirectoryPath: string): Promise<void> {
    const entries = await readdir(tempDirectoryPath, { withFileTypes: true });

    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && parseChunkIndex(entry.name) !== null)
        .map((entry) => rm(path.join(tempDirectoryPath, entry.name), { force: true }))
    );
  }

  private async listChunkFilePaths(tempDirectoryPath: string): Promise<string[]> {
    const entries = await readdir(tempDirectoryPath, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const index = parseChunkIndex(entry.name);
        return index === null
          ? null
          : {
              filePath: path.join(tempDirectoryPath, entry.name),
              index
            };
      })
      .filter((entry): entry is { filePath: string; index: number } => Boolean(entry))
      .sort((left, right) => left.index - right.index)
      .map((entry) => entry.filePath);
  }

  private async findOversizedChunk(
    chunkFilePaths: string[]
  ): Promise<{ filePath: string; sizeBytes: number } | null> {
    for (const chunkFilePath of chunkFilePaths) {
      const chunkStat = await stat(chunkFilePath);

      if (chunkStat.size > MAX_CHUNK_SIZE_BYTES) {
        return {
          filePath: chunkFilePath,
          sizeBytes: chunkStat.size
        };
      }
    }

    return null;
  }

  private async buildChunkMetadata(
    tempDirectoryPath: string,
    fallbackDurationSeconds: number
  ): Promise<AudioChunk[]> {
    const chunkFilePaths = await this.listChunkFilePaths(tempDirectoryPath);

    let cursorSeconds = 0;
    const chunks: AudioChunk[] = [];

    for (const chunkFilePath of chunkFilePaths) {
      const fileName = path.basename(chunkFilePath);
      const index = parseChunkIndex(fileName);

      if (index === null) {
        continue;
      }

      const chunkStat = await stat(chunkFilePath);
      const measuredDurationSeconds = await this.probeAudioDurationSeconds(chunkFilePath).catch(
        () => fallbackDurationSeconds
      );
      const durationSeconds = Math.max(1, measuredDurationSeconds);

      chunks.push({
        index,
        filePath: chunkFilePath,
        startSeconds: cursorSeconds,
        durationSeconds,
        sizeBytes: chunkStat.size
      });

      cursorSeconds += durationSeconds;
    }

    return chunks;
  }

  private runCommand(
    command: string,
    args: string[]
  ): Promise<{
    stdout: string;
    stderr: string;
  }> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });

      process.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });

      process.once('error', (error) => {
        reject(
          new AppError(500, `Falha ao executar comando ${command}.`, {
            cause: toErrorMessage(error)
          })
        );
      });

      process.once('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        reject(
          new AppError(500, `Comando ${command} retornou código ${code ?? 'desconhecido'}.`, {
            stderr: stderr.trim().slice(0, 1200)
          })
        );
      });
    });
  }
}

export const audioProcessingService = new AudioProcessingService();
