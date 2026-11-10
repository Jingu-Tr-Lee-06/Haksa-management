import { NextRequest, NextResponse } from 'next/server';

interface ParsedCourse {
  course_code?: string;
  course_name: string;
  credit: number;
  category: string; // 전공, 교직, 교양 등
  grade: string;
  year?: number;
  semester?: string;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let rawText = '';

    // 1. FormData (파일 업로드) 또는 JSON 수신 분기 처리
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const textParam = formData.get('text') as string | null;

      if (textParam) {
        rawText = textParam;
      } else if (file) {
        const buffer = await file.arrayBuffer();
        rawText = new TextDecoder('utf-8').decode(buffer);
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      rawText = body.text || body.content || '';
    } else {
      rawText = await req.text();
    }

    if (!rawText || rawText.trim().length === 0) {
      console.error('[/api/parse-transcript] 성적표 본문 데이터가 비어 있습니다.');
      return NextResponse.json(
        { error: '성적표 데이터가 비어 있거나 텍스트를 추출할 수 없습니다.' },
        { status: 422 }
      );
    }

    console.log('[/api/parse-transcript] 원본 텍스트 수신 길이:', rawText.length);

    // 2. 포털 성적 텍스트 라인별 파싱
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsedCourses: ParsedCourse[] = [];

    // 공주대 포털/종합정보 성적표 표준 라인 패턴 매칭:
    // 예: [2025] [1학기] [컴퓨터교육론] [전선/전필/교직/기교/심교] [3] [A+]
    // 또는 탭(\t) 및 다중 공백으로 구분된 행 데이터 처리
    const tableRowRegex = /^(?:(\d{4})[-.\s년]*)?(?:(\d|1학기|2학기|여름|겨울)학기?)?\s*([가-힣A-Za-z0-9_·()\s]{2,40})\s+(전필|전선|전공|교직|교필|교선|일선|기교|심교|균형)\s+(\d(?:\.\d)?)\s+([A-D][+]?|F|P|NP|S|U)/i;

    for (const line of lines) {
      // 탭 구분 텍스트 우선 처리 (드래그 복사 붙여넣기 대응)
      const tabCols = line.split('\t').map((c) => c.trim()).filter(Boolean);

      if (tabCols.length >= 4) {
        // [과목명, 이수구분, 학점, 등급] 형태 분석
        const creditIdx = tabCols.findIndex((c) => /^\d(\.0)?$/.test(c));
        const gradeIdx = tabCols.findIndex((c) => /^[A-D][+]?$|^[FP]$/i.test(c));

        if (creditIdx !== -1 && gradeIdx !== -1 && creditIdx < tabCols.length) {
          const courseName = tabCols[creditIdx - 2] || tabCols[0];
          const category = tabCols[creditIdx - 1] || '전선';
          const credit = parseFloat(tabCols[creditIdx]);
          const grade = tabCols[gradeIdx].toUpperCase();

          if (courseName && !isNaN(credit)) {
            parsedCourses.push({
              course_name: courseName.replace(/^[0-9-]+\s*/, ''),
              credit,
              category,
              grade,
            });
            continue;
          }
        }
      }

      // 공백 정규식 매칭
      const match = line.match(tableRowRegex);
      if (match) {
        const [, year, semester, courseName, category, credit, grade] = match;
        parsedCourses.push({
          year: year ? parseInt(year, 10) : undefined,
          semester: semester ? semester : undefined,
          course_name: courseName.trim(),
          category: category.trim(),
          credit: parseFloat(credit),
          grade: grade.toUpperCase(),
        });
      }
    }

    // 파싱된 과목이 0건일 경우 422 대신 안내와 함께 빈 배열 반환 또는 기본 텍스트 정밀 분해
    if (parsedCourses.length === 0) {
      console.warn('[/api/parse-transcript] 정규식 패턴 불일치. 원본 샘플:', lines.slice(0, 5));
      return NextResponse.json(
        {
          error: '성적표에서 교과목 목록을 인식하지 못했습니다. 포털 성적 내역을 텍스트로 직접 복사하거나 올바른 파일을 첨부하십시오.',
          preview: lines.slice(0, 10),
        },
        { status: 422 }
      );
    }

    console.log(`[/api/parse-transcript] 파싱 성공 과목 수: ${parsedCourses.length}`);

    return NextResponse.json({
      success: true,
      courses: parsedCourses,
      totalCount: parsedCourses.length,
    });
  } catch (error) {
    console.error('[/api/parse-transcript] 서버 처리 예외:', error);
    return NextResponse.json(
      { error: '성적표 파싱 처리 중 서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}