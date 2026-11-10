import { NextRequest, NextResponse } from 'next/server';
import { generateContentStreamWithFallback } from '@/lib/gemini/fallback';
import { retrieveRelevantRegulations } from '@/lib/gemini/rag';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: '질의 내용(query)을 입력해 주십시오.' },
        { status: 400 }
      );
    }

    // 클라이언트 헤더에서 사용자 개인 API 키 추출
    const customApiKey = req.headers.get('x-gemini-api-key');

    // 1. 학사 규정집 RAG 컨텍스트 검색 및 참조 조항 추출
    const { context, sources } = await retrieveRelevantRegulations(query.trim());

    // 2. 시스템 프롬프트 및 사용자 질의 프롬프트 구성
    const systemInstruction = `
당신은 국립공주대학교 학사 규정 및 교원자격 무시험검정 사정 전문 AI 어드바이저입니다.
제공된 규정 컨텍스트만을 근거로 삼아 명확하고 논리정연하게 답변하십시오.
컨텍스트에 조항이 명시된 경우 관련 조항 명칭(예: 학칙 제O조, 규정 제O조)을 정확히 인용하고, 불확실하거나 규정에 명시되지 않은 사항은 단정 짓지 말고 공식 학사지원팀 또는 사범대학 교직부에 문의하도록 안내하십시오.
`;

    const userPrompt = `
[국립공주대학교 관련 학사 규정 및 예규 참고 자료]
${context}

[학생 질의 내용]
${query.trim()}

위 자료를 토대로 학생의 질의에 대한 명확한 답변을 조항 근거와 함께 작성하십시오.
`;

    // 3. 최신 Gemini 모델 스트리밍 폴백 호출 (사용자 개인 키 우선 적용)
    const { streamResult, modelUsed } = await generateContentStreamWithFallback(
      userPrompt,
      systemInstruction,
      customApiKey
    );

    // 4. Server-Sent Events(SSE) 규격의 ReadableStream 구성
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const metaEvent = `event: meta\ndata: ${JSON.stringify({ sources, modelUsed })}\n\n`;
          controller.enqueue(encoder.encode(metaEvent));

          for await (const chunk of streamResult.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              const messageEvent = `event: message\ndata: ${JSON.stringify({ text: chunkText })}\n\n`;
              controller.enqueue(encoder.encode(messageEvent));
            }
          }

          controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
          controller.close();
        } catch (streamError: any) {
          console.error('스트림 파이프라인 에러:', streamError);
          const errorEvent = `event: error\ndata: ${JSON.stringify({
            error: streamError?.message || '스트리밍 생성 도중 오류가 발생했습니다.',
          })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error('학사 규정 질의 라우트 에러:', errorMsg);

    // 할당량 초과 시 429 상태코드 및 명확한 에러 메시지 반환
    if (errorMsg.includes('QUOTA_EXCEEDED') || errorMsg.includes('429')) {
      return NextResponse.json(
        {
          error: 'QUOTA_EXCEEDED',
          message: '현재 서버의 AI 토큰 일일 무료 제공량이 모두 소진되었습니다. 우측 상단의 [개인 API 키 등록]을 통해 무료 키를 등록하시면 즉시 이용하실 수 있습니다.',
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: errorMsg || '학사 규정 질의 처리 중 서버 내부 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}