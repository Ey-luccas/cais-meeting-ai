import { spawn } from 'node:child_process';
import { access, mkdtemp, readdir, rm, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env';
import type { GeneratedNotesPayload, TranscriptionPayload } from '../types';
import { AppError, logger, uploadDirAbsolutePath } from '../utils';
import { deepseekService } from './deepseek.service';
import { groqService } from './groq.service';

type ChunkTranscription = {
  index: number;
  path: string;
  fullText: string;
  language: string | null;
  rawJson: unknown;
  durationSeconds: number | null;
  sizeBytes: number;
};

type CommandResult = {
  stdout: string;
  stderr: string;
};

const CHUNK_OUTPUT_PREFIX = 'chunk';
const CHUNK_TARGET_BITRATE = '48k';
const CHUNK_TARGET_SAMPLE_RATE = '16000';

const bytesToMb = (value: number): number => {
  return Number((value / (1024 * 1024)).toFixed(2));
};

export class AudioProcessingService {
  private readonly maxChunkBytes = env.GROQ_MAX_CHUNK_MB * 1024 * 1024;

  private ffmpegChecked = false;

  async splitAudioIntoChunks(filePath: string, workingDir?: string): Promise<string[]> {
    await this.assertFileReadable(filePath);
    await this.assertFfmpegBinaries();

    const workspace = workingDir ?? (await this.createWorkspace());

    logger.info('Iniciando divisão de áudio em chunks.', {
      filePath,
      chunkSeconds: env.AUDIO_CHUNK_SECONDS,
      maxChunkMb: env.GROQ_MAX_CHUNK_MB
    });

    const initialChunks = await this.createSegments({
      inputPath: filePath,
      outputDirectory: workspace,
      outputPrefix: CHUNK_OUTPUT_PREFIX,
      segmentSeconds: env.AUDIO_CHUNK_SECONDS
    });

    if (initialChunks.length === 0) {
      throw new AppError(502, 'Não foi possível gerar chunks do áudio para transcrição.');
    }

    const preparedChunks: string[] = [];
    for (const chunkPath of initialChunks) {
      const splitResult = await this.ensureChunkWithinSizeLimit(chunkPath, workspace);
      preparedChunks.push(...splitResult);
    }

    logger.info('Divisão de áudio concluída.', {
      filePath,
      generatedChunks: preparedChunks.length
    });

    return preparedChunks;
  }

  async transcribeChunk(chunkPath: string, chunkIndex = 1): Promise<string> {
    const result = await this.transcribeChunkWithRetry(chunkPath, chunkIndex);
    return result.fullText;
  }

  mergeTranscripts(transcripts: string[]): string {
    return transcripts
      .map((chunkText) => chunkText.trim())
      .filter((chunkText) => chunkText.length > 0)
      .join('\n\n');
  }

  async transcribeMeetingAudio(filePath: string): Promise<TranscriptionPayload> {
    await this.assertFileReadable(filePath);

    const workspace = await this.createWorkspace();

    logger.info('Iniciando pipeline de transcrição por chunks.', { filePath, workspace });

    try {
      const chunkPaths = await this.splitAudioIntoChunks(filePath, workspace);

      const transcriptions: ChunkTranscription[] = [];
      for (const [index, chunkPath] of chunkPaths.entries()) {
        const chunkResult = await this.transcribeChunkWithRetry(chunkPath, index + 1);
        transcriptions.push(chunkResult);
      }

      transcriptions.sort((a, b) => a.index - b.index);
      const mergedText = this.mergeTranscripts(transcriptions.map((chunk) => chunk.fullText));

      if (!mergedText) {
        throw new AppError(502, 'A transcrição final resultou vazia após processar os chunks.');
      }

      const language = this.resolveMainLanguage(transcriptions);
      const totalDuration =
        Math.round(
          transcriptions.reduce((acc, item) => {
            return acc + (item.durationSeconds ?? 0);
          }, 0)
        ) || (await this.probeDurationSeconds(filePath));

      logger.info('Pipeline de transcrição concluído.', {
        filePath,
        chunks: transcriptions.length,
        language,
        durationSeconds: totalDuration
      });

      return {
        fullText: mergedText,
        language,
        durationSeconds: totalDuration > 0 ? totalDuration : null,
        rawJson: {
          strategy: 'ffmpeg_chunked_transcription',
          chunkSeconds: env.AUDIO_CHUNK_SECONDS,
          maxChunkMb: env.GROQ_MAX_CHUNK_MB,
          chunks: transcriptions.map((item) => ({
            index: item.index,
            file: path.basename(item.path),
            sizeBytes: item.sizeBytes,
            sizeMb: bytesToMb(item.sizeBytes),
            language: item.language,
            durationSeconds: item.durationSeconds,
            textLength: item.fullText.length,
            response: item.rawJson
          }))
        }
      };
    } finally {
      await this.cleanupWorkspace(workspace);
    }
  }

  async generateMeetingNotes(transcript: string): Promise<GeneratedNotesPayload> {
    return deepseekService.generateMeetingNotes(transcript);
  }

  private async transcribeChunkWithRetry(chunkPath: string, chunkIndex: number): Promise<ChunkTranscription> {
    await this.assertFileReadable(chunkPath);
    const chunkSize = (await stat(chunkPath)).size;

    let currentAttempt = 0;
    const maxAttempts = env.GROQ_CHUNK_RETRY_ATTEMPTS + 1;
    let lastError: unknown = null;

    while (currentAttempt < maxAttempts) {
      currentAttempt += 1;

      try {
        logger.info('Transcrevendo chunk.', {
          chunkIndex,
          attempt: currentAttempt,
          maxAttempts,
          chunkPath: path.basename(chunkPath),
          sizeMb: bytesToMb(chunkSize)
        });

        const transcription = await groqService.transcribeMeetingAudio(chunkPath);

        return {
          index: chunkIndex,
          path: chunkPath,
          fullText: transcription.fullText,
          language: transcription.language,
          rawJson: transcription.rawJson,
          durationSeconds: transcription.durationSeconds,
          sizeBytes: chunkSize
        };
      } catch (error) {
        lastError = error;

        logger.warn('Falha na transcrição de chunk, tentando reprocessar.', {
          chunkIndex,
          attempt: currentAttempt,
          maxAttempts,
          error: error instanceof Error ? error.message : 'unknown_error'
        });

        if (currentAttempt < maxAttempts) {
          await this.wait(500 * currentAttempt);
        }
      }
    }

    throw new AppError(502, `Falha ao transcrever o chunk ${chunkIndex} após ${maxAttempts} tentativas.`, {
      chunkIndex,
      chunkPath: path.basename(chunkPath),
      cause: lastError instanceof Error ? lastError.message : 'unknown_error'
    });
  }

  private async ensureChunkWithinSizeLimit(chunkPath: string, workspace: string): Promise<string[]> {
    const chunkStats = await stat(chunkPath);
    if (chunkStats.size <= this.maxChunkBytes) {
      return [chunkPath];
    }

    const chunkDuration = await this.probeDurationSeconds(chunkPath);
    const nextSegmentSeconds = this.calculateReducedSegmentDuration({
      chunkDuration,
      chunkSizeBytes: chunkStats.size
    });

    logger.warn('Chunk acima do limite da Groq. Re-dividindo automaticamente.', {
      chunk: path.basename(chunkPath),
      chunkSizeMb: bytesToMb(chunkStats.size),
      maxChunkMb: env.GROQ_MAX_CHUNK_MB,
      previousDurationSeconds: chunkDuration,
      nextSegmentSeconds
    });

    if (nextSegmentSeconds <= env.AUDIO_MIN_CHUNK_SECONDS && chunkStats.size > this.maxChunkBytes) {
      throw new AppError(400, 'Não foi possível reduzir um chunk para abaixo do limite da Groq.', {
        chunk: path.basename(chunkPath),
        chunkSizeMb: bytesToMb(chunkStats.size),
        maxChunkMb: env.GROQ_MAX_CHUNK_MB,
        recommendation: 'Reduza a qualidade/bitrate do áudio antes de enviar.'
      });
    }

    const extension = path.extname(chunkPath) || '.mp3';
    const nestedPrefix = path.basename(chunkPath, extension);
    const nestedChunks = await this.createSegments({
      inputPath: chunkPath,
      outputDirectory: workspace,
      outputPrefix: `${nestedPrefix}-part`,
      segmentSeconds: nextSegmentSeconds
    });

    await unlink(chunkPath).catch(() => undefined);

    const validated: string[] = [];
    for (const nestedChunk of nestedChunks) {
      const result = await this.ensureChunkWithinSizeLimit(nestedChunk, workspace);
      validated.push(...result);
    }

    return validated;
  }

  private calculateReducedSegmentDuration(input: {
    chunkDuration: number;
    chunkSizeBytes: number;
  }): number {
    const { chunkDuration, chunkSizeBytes } = input;
    if (chunkDuration <= env.AUDIO_MIN_CHUNK_SECONDS) {
      return env.AUDIO_MIN_CHUNK_SECONDS;
    }

    const safetyFactor = 0.9;
    const estimated = Math.floor(chunkDuration * (this.maxChunkBytes / chunkSizeBytes) * safetyFactor);

    return Math.max(
      env.AUDIO_MIN_CHUNK_SECONDS,
      Math.min(chunkDuration - 1, estimated > 0 ? estimated : env.AUDIO_MIN_CHUNK_SECONDS)
    );
  }

  private async createSegments(input: {
    inputPath: string;
    outputDirectory: string;
    outputPrefix: string;
    segmentSeconds: number;
  }): Promise<string[]> {
    const { inputPath, outputDirectory, outputPrefix, segmentSeconds } = input;
    const outputPattern = path.join(outputDirectory, `${outputPrefix}-%04d.mp3`);

    await this.runCommand(env.FFMPEG_BIN, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      CHUNK_TARGET_SAMPLE_RATE,
      '-c:a',
      'libmp3lame',
      '-b:a',
      CHUNK_TARGET_BITRATE,
      '-f',
      'segment',
      '-segment_time',
      String(segmentSeconds),
      '-reset_timestamps',
      '1',
      outputPattern
    ]);

    const chunkFiles = await readdir(outputDirectory);

    return chunkFiles
      .filter((entry) => entry.startsWith(`${outputPrefix}-`) && entry.endsWith('.mp3'))
      .sort((a, b) => a.localeCompare(b))
      .map((entry) => path.join(outputDirectory, entry));
  }

  private async probeDurationSeconds(filePath: string): Promise<number> {
    const probeResult = await this.runCommand(env.FFPROBE_BIN, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);

    const duration = Number(probeResult.stdout.trim());
    return Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : 0;
  }

  private resolveMainLanguage(transcriptions: ChunkTranscription[]): string | null {
    const frequency = new Map<string, number>();

    for (const item of transcriptions) {
      const language = item.language?.trim().toLowerCase();
      if (!language) {
        continue;
      }

      frequency.set(language, (frequency.get(language) ?? 0) + 1);
    }

    let resolvedLanguage: string | null = null;
    let highestCount = 0;

    for (const [language, count] of frequency.entries()) {
      if (count > highestCount) {
        resolvedLanguage = language;
        highestCount = count;
      }
    }

    return resolvedLanguage;
  }

  private async assertFfmpegBinaries(): Promise<void> {
    if (this.ffmpegChecked) {
      return;
    }

    try {
      await this.runCommand(env.FFMPEG_BIN, ['-version']);
      await this.runCommand(env.FFPROBE_BIN, ['-version']);
      this.ffmpegChecked = true;
    } catch (error) {
      throw new AppError(
        500,
        'FFmpeg/FFprobe não disponíveis no servidor. Instale os binários para processar áudios longos.',
        {
          ffmpegBin: env.FFMPEG_BIN,
          ffprobeBin: env.FFPROBE_BIN,
          cause: error instanceof Error ? error.message : 'unknown_error'
        }
      );
    }
  }

  private async assertFileReadable(filePath: string): Promise<void> {
    try {
      await access(filePath);
    } catch {
      throw new AppError(400, 'Arquivo de áudio não encontrado para processamento.');
    }
  }

  private async createWorkspace(): Promise<string> {
    return mkdtemp(path.join(uploadDirAbsolutePath, 'chunks-'));
  }

  private async cleanupWorkspace(workspace: string): Promise<void> {
    await rm(workspace, { recursive: true, force: true });
  }

  private async runCommand(binary: string, args: string[]): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(binary, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        reject(
          new AppError(502, `Falha ao executar comando ${binary}.`, {
            command: binary,
            args,
            exitCode: code,
            stderr: stderr.trim().slice(0, 2000)
          })
        );
      });
    });
  }

  private async wait(milliseconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}

export const audioProcessingService = new AudioProcessingService();
