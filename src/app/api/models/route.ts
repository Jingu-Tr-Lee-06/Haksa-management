import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // 헤더에 전달된 개인 키가 있으면 우선 사용하고, 없으면 환경변수 키 사용
    const customKey = req.headers.get('x-gemini-api-key');
    const apiKey = customKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY가 설정되어 있지 않습니다.' },
        { status: 400 }
      );
    }

    // Google Generative Language REST API 직접 호출 (ModelService.ListModels)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: '모델 목록 조회 실패',
          status: response.status,
          details: errData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const models = data.models || [];

    // generateContent(텍스트 생성)를 지원하는 모델만 필터링하여 정돈
    const contentModels = models
      .filter((m: any) =>
        m.supportedGenerationMethods?.includes('generateContent')
      )
      .map((m: any) => ({
        name: m.name.replace('models/', ''),
        displayName: m.displayName,
        description: m.description,
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit,
        supportedMethods: m.supportedGenerationMethods,
      }));

    return NextResponse.json({
      totalCount: models.length,
      generateContentModelsCount: contentModels.length,
      models: contentModels,
      rawModels: models.map((m: any) => m.name.replace('models/', '')),
    });
  } catch (error: any) {
    console.error('모델 목록 조회 에러:', error);
    return NextResponse.json(
      { error: error?.message || '서버 내부 오류' },
      { status: 500 }
    );
  }
}