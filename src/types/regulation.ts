export interface RegulationCitation {
  sourceDoc: '학칙' | '규정집' | '예규집';
  docNumber?: string;
  articleNumber: string; // 예: "제97조"
  articleTitle: string;  // 예: "학사과정의 조기졸업"
  clauseNumber?: string; // 예: "제1항"
  itemNumber?: string;   // 예: "제1호"
  pageNumber: number;    // PDF 원문 페이지 번호
  exactQuote: string;    // 원문 인용 텍스트
}

export interface RegulationSearchQuery {
  query: string;
  category?: '졸업' | '조기졸업' | '수강신청' | '학점인정' | '교직' | '복수전공' | '전체';
}

export interface RegulationSearchResult {
  query: string;
  answerBulletPoints: string[]; // 개조식 답변 리스트
  citations: RegulationCitation[];
  fallbackModelUsed: string;    // 실제 응답에 사용된 Gemini 모델명
  isGroundingVerified: boolean;
}

export interface RegulationChunk {
  id: string;
  sourceDoc: '학칙' | '규정집' | '예규집';
  regulationName: string;
  articleNumber: string;
  articleTitle: string;
  pageNumber: number;
  content: string;
  keywords: string[];
}