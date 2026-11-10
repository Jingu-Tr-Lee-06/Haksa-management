import { RegulationChunk, RegulationSearchResult, RegulationCitation } from '@/types/regulation';
import { generateContentWithFallback } from './fallback';
import fs from 'fs';
import path from 'path';

/**
 * 프론트엔드 및 API 라우트 호환용 인터페이스
 */
export interface CompatibleRagResult extends RegulationSearchResult {
  answer: string;
  sources: {
    title: string;
    article: string;
    content: string;
  }[];
}

/**
 * 스트리밍 API 라우트용 검색 반환 규격
 */
export interface RagSearchResult {
  context: string;
  sources: {
    title: string;
    article: string;
    content: string;
  }[];
}

/**
 * 정적 JSON 파일로부터 학사 규정 청크 데이터를 로드한다.
 */
export function getRegulationChunks(): RegulationChunk[] {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'regulations.json');
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const rawData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(rawData) as RegulationChunk[];
  } catch (error) {
    console.error('학사 규정 청크 파일 로드 실패:', error);
    return [];
  }
}

/**
 * 검색어와 규정 청크 간의 키워드 일치 점수를 계산하여 상위 청크를 추출한다.
 */
function searchRelevantChunks(query: string, chunks: RegulationChunk[], topK: number = 5): RegulationChunk[] {
  const cleaned = query.replace(/[?.,!~]/g, '');
  const tokens = cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 2);

  const scoredChunks = chunks.map((chunk) => {
    let score = 0;
    const titleLower = (chunk.articleTitle || '').toLowerCase();
    const contentLower = (chunk.content || '').toLowerCase();
    const regNameLower = (chunk.regulationName || '').toLowerCase();
    const keywordsLower = (chunk.keywords || []).map((k) => k.toLowerCase());

    for (const token of tokens) {
      if (titleLower.includes(token)) score += 6;
      if (keywordsLower.some((kw) => kw.includes(token))) score += 4;
      if (regNameLower.includes(token)) score += 2;
      if (contentLower.includes(token)) score += 1;
    }

    // 사범대 핵심 복합어 가중치 보정
    if (cleaned.includes('복수전공') && (titleLower.includes('복수전공') || keywordsLower.includes('복수전공'))) score += 5;
    if (cleaned.includes('기본이수') && (titleLower.includes('기본이수') || contentLower.includes('기본이수'))) score += 5;
    if (cleaned.includes('교과교육') && (titleLower.includes('교과교육') || contentLower.includes('교과교육'))) score += 5;
    if (cleaned.includes('이월') && (titleLower.includes('이월') || contentLower.includes('이월'))) score += 5;
    if (cleaned.includes('조기졸업') && (titleLower.includes('조기졸업') || contentLower.includes('조기졸업'))) score += 5;

    return { chunk, score };
  });

  return scoredChunks
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item) => item.chunk);
}

/**
 * 스트리밍 API 라우트 전용: 관련 규정 청크 검색 및 프롬프트 컨텍스트/출처 추출 함수
 */
export async function retrieveRelevantRegulations(query: string): Promise<RagSearchResult> {
  const chunks = getRegulationChunks();
  const relevantChunks = searchRelevantChunks(query, chunks, 5);

  if (relevantChunks.length === 0) {
    return {
      context: '관련된 구체적인 학사 규정 조항을 데이터베이스에서 찾을 수 없습니다.',
      sources: [],
    };
  }

  const context = relevantChunks
    .map(
      (c, idx) =>
        `[참고자료 ${idx + 1}]\n출처: 국립공주대학교 ${c.sourceDoc} (${c.regulationName})\n조항: ${c.articleNumber} (${c.articleTitle})\n수록 페이지: p.${c.pageNumber}\n내용: ${c.content}`
    )
    .join('\n\n');

  const sources = relevantChunks.map((chunk) => ({
    title: `${chunk.sourceDoc} (${chunk.regulationName})`,
    article: `${chunk.articleNumber} ${chunk.articleTitle}`,
    content: chunk.content,
  }));

  return { context, sources };
}

/**
 * 단건(Non-Streaming) 학사 규정 기반 RAG 질의응답을 수행한다.
 */
export async function queryRegulationRag(query: string): Promise<CompatibleRagResult> {
  const chunks = getRegulationChunks();
  const relevantChunks = searchRelevantChunks(query, chunks, 5);

  if (relevantChunks.length === 0) {
    const emptyAnswer =
      '해당 질의와 관련된 구체적인 국립공주대학교 학사 규정 또는 사범대학 예규 조항을 데이터베이스에서 찾을 수 없습니다.\n소속 학과 사무실 또는 사범대학 교직부/교무처로 문의하시기 바랍니다.';
    return {
      query,
      answer: emptyAnswer,
      answerBulletPoints: [
        '해당 질의와 관련된 구체적인 학사 규정 또는 예규 조항을 찾을 수 없습니다.',
        '소속 학과 사무실 또는 교무과를 통해 직접 확인하시기 바랍니다.',
      ],
      sources: [],
      citations: [],
      fallbackModelUsed: 'none',
      isGroundingVerified: false,
    };
  }

  const contextText = relevantChunks
    .map(
      (c, idx) =>
        `[참고자료 ${idx + 1}]\n출처: 국립공주대학교 ${c.sourceDoc} (${c.regulationName})\n조항: ${c.articleNumber} (${c.articleTitle})\n수록 페이지: p.${c.pageNumber}\n내용: ${c.content}`
    )
    .join('\n\n');

  const systemInstruction = `당신은 국립공주대학교 사범대학 학사 규정 및 교원자격검정 예규 전문 AI 어시스턴트이다.
반드시 제공된 [참고자료]의 규정 조항에만 엄격히 근거하여 사실 그대로 답변해야 한다.
없는 내용을 지어내거나 일반적인 타 대학 규칙을 적용해서는 안 된다.
문체는 신뢰성 있고 명확한 어조를 유지하며, 각 조항 번호와 근거를 함께 명시한다.`;

  const prompt = `질문: "${query}"

아래 제공된 공주대학교 학사 규정 참고자료만을 근거로 삼아 명확하고 상세하게 답변하십시오.

${contextText}

[답변 작성 지침]
1. 질문에 대한 핵심 요건을 먼저 명확히 제시하십시오.
2. 각 요건이 규정의 어떤 조항(예: 학사운영규정 제00조, 교원자격검정예규 제00조)에 근거하는지 명시하십시오.
3. 개조식(- )으로 정리하여 가독성을 높이십시오.`;

  const fallbackResult = await generateContentWithFallback(prompt, systemInstruction);
  const rawText = fallbackResult.text.trim();

  const answerBulletPoints = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-') || line.startsWith('•') || line.startsWith('*'))
    .map((line) => line.replace(/^[-•*]\s*/, ''));

  const citations: RegulationCitation[] = relevantChunks.map((chunk) => ({
    sourceDoc: chunk.sourceDoc,
    articleNumber: chunk.articleNumber,
    articleTitle: chunk.articleTitle,
    pageNumber: chunk.pageNumber,
    exactQuote: chunk.content.slice(0, 150) + (chunk.content.length > 150 ? '...' : ''),
  }));

  const sources = relevantChunks.map((chunk) => ({
    title: `${chunk.sourceDoc} (${chunk.regulationName})`,
    article: `${chunk.articleNumber} ${chunk.articleTitle}`,
    content: chunk.content,
  }));

  return {
    query,
    answer: rawText,
    answerBulletPoints: answerBulletPoints.length > 0 ? answerBulletPoints : [rawText],
    sources,
    citations,
    fallbackModelUsed: fallbackResult.modelUsed,
    isGroundingVerified: true,
  };
}