import { GoogleGenerativeAI, GenerateContentResult, GenerateContentStreamResult } from '@google/generative-ai';
import { genAI as defaultServerGenAI } from './client';

// API 키에서 조회된 48개 모델 중 텍스트 생성/대화가 가능한 모든 모델 전수 포함
const GEMINI_TEXT_MODELS = [
  // 1티어: 최신 Flash 계열 (초고속 스트리밍)
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-flash-latest',

  // 2티어: 고성능 추론 및 심층 사정 분석 계열 (Pro)
  'gemini-3.1-pro-preview',
  'gemini-3.1-pro-preview-customtools',
  'gemini-pro-latest',
  'gemini-4-argon',
  'gemini-4-carbon',

  // 3티어: 초경량 Lite 계열 (할당량 분산 및 저지연)
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',

  // 4티어: 오픈 가중치 Gemma 및 안정화 모델
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
] as const;

export interface FallbackExecutionResult {
  text: string;
  modelUsed: string;
}

export interface FallbackStreamResult {
  streamResult: GenerateContentStreamResult;
  modelUsed: string;
}

function isQuotaExceededError(error: unknown): boolean {
  const errMsg = error instanceof Error ? error.message : String(error);
  return (
    errMsg.includes('429') ||
    errMsg.includes('Quota exceeded') ||
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.includes('rate limit')
  );
}

function resolveGenAIClient(customApiKey?: string | null): GoogleGenerativeAI {
  if (customApiKey && customApiKey.trim().length > 0) {
    return new GoogleGenerativeAI(customApiKey.trim());
  }
  return defaultServerGenAI;
}

/**
 * 20개 순수 텍스트 모델을 대상으로 순차 스트리밍 폴백 실행
 */
export async function generateContentStreamWithFallback(
  prompt: string,
  systemInstruction?: string,
  customApiKey?: string | null
): Promise<FallbackStreamResult> {
  const activeClient = resolveGenAIClient(customApiKey);
  let lastError: unknown = null;
  let hitQuotaLimit = false;

  for (const modelName of GEMINI_TEXT_MODELS) {
    try {
      const model = activeClient.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction
          ? {
              role: 'system',
              parts: [{ text: systemInstruction }],
            }
          : undefined,
      });

      const streamResult = await model.generateContentStream(prompt);
      return {
        streamResult,
        modelUsed: modelName,
      };
    } catch (error) {
      lastError = error;
      if (isQuotaExceededError(error)) {
        hitQuotaLimit = true;
      }
      continue;
    }
  }

  if (hitQuotaLimit) {
    throw new Error(
      'QUOTA_EXCEEDED: 현재 사용 가능한 모든 텍스트 모델의 일일 무료 제공량이 소진되었습니다. 개인 API 키를 등록하거나 잠시 후 다시 시도해 주십시오.'
    );
  }

  throw new Error(
    `모든 Gemini 텍스트 모델 스트리밍 호출 실패: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

/**
 * 20개 순수 텍스트 모델을 대상으로 순차 단건 폴백 실행
 */
export async function generateContentWithFallback(
  prompt: string,
  systemInstruction?: string,
  customApiKey?: string | null
): Promise<FallbackExecutionResult> {
  const activeClient = resolveGenAIClient(customApiKey);
  let lastError: unknown = null;
  let hitQuotaLimit = false;

  for (const modelName of GEMINI_TEXT_MODELS) {
    try {
      const model = activeClient.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction
          ? {
              role: 'system',
              parts: [{ text: systemInstruction }],
            }
          : undefined,
      });

      const result: GenerateContentResult = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (text && text.trim().length > 0) {
        return {
          text,
          modelUsed: modelName,
        };
      }
    } catch (error) {
      lastError = error;
      if (isQuotaExceededError(error)) {
        hitQuotaLimit = true;
      }
      continue;
    }
  }

  if (hitQuotaLimit) {
    throw new Error(
      'QUOTA_EXCEEDED: 현재 사용 가능한 모든 텍스트 모델의 일일 무료 제공량이 소진되었습니다. 개인 API 키를 등록하거나 잠시 후 다시 시도해 주십시오.'
    );
  }

  throw new Error(
    `모든 Gemini 텍스트 모델 호출에 실패했습니다: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

/**
 * 멀티모달 비전 이미지 분석 폴백 함수 (비전 지원 모델 선별)
 */
export async function generateContentWithVisionFallback(
  prompt: string,
  base64Image: string,
  mimeType: string,
  systemInstruction?: string,
  customApiKey?: string | null
): Promise<FallbackExecutionResult> {
  const activeClient = resolveGenAIClient(customApiKey);
  let lastError: unknown = null;
  let hitQuotaLimit = false;

  // 비전(멀티모달) 처리가 검증된 모델만 선별
  const VISION_MODELS = [
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-3.1-pro-preview',
    'gemini-2.5-flash',
  ] as const;

  for (const modelName of VISION_MODELS) {
    try {
      const model = activeClient.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction
          ? {
              role: 'system',
              parts: [{ text: systemInstruction }],
            }
          : undefined,
      });

      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      };

      const result: GenerateContentResult = await model.generateContent([
        prompt,
        imagePart,
      ]);
      const response = await result.response;
      const text = response.text();

      if (text && text.trim().length > 0) {
        return {
          text,
          modelUsed: modelName,
        };
      }
    } catch (error) {
      lastError = error;
      if (isQuotaExceededError(error)) {
        hitQuotaLimit = true;
      }
      continue;
    }
  }

  if (hitQuotaLimit) {
    throw new Error(
      'QUOTA_EXCEEDED: 이미지 분석 무료 토큰 할당량이 초과되었습니다. 잠시 후 다시 시도해 주십시오.'
    );
  }

  throw new Error(
    `모든 비전 모델 호출에 실패했습니다: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}