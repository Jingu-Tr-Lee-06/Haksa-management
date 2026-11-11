import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export interface ParsedCourse {
  course_code?: string;
  course_name: string;
  credit: number;
  category: string;       // 정규화된 표준 카테고리
  raw_category: string;   // 성적표 원본 이수구분 표기
  grade: string;
  is_passed: boolean;     // 학점 인정 여부 (F, NP, U 제외)
  year?: number;
  semester?: string;
}

/**
 * 공주대학교 포털 표기 기반 이수구분 표준화 헬퍼
 */
function normalizeCategory(raw: string): string {
  const c = raw.trim();
  if (/^(복전|복필|복선|복수)/.test(c)) return '복수전공';
  if (/^(부전|부필|부선)/.test(c)) return '부전공';
  if (/^(전기|전공기초)/.test(c)) return '전공기초';
  if (/^(전필|전공필수|전핵|전공핵심)/.test(c)) return '전공핵심';
  if (/^(전선|전공선택|전심|전공심화|전공)/.test(c)) return '전공심화';
  if (/^(교직|교직이론|교직소양|교직실습|교육실습)/.test(c)) return '교직';
  if (/^(기교|기초교양|교필)/.test(c)) return '기초교양';
  if (/^(심교|균형|균형교양|교선)/.test(c)) return '균형교양';
  if (/^(일선|일반선택|자선)/.test(c)) return '일반선택';
  return c;
}

/**
 * 성적 등급 기반 이수 통과 여부 판정
 */
function checkIsPassed(grade: string): boolean {
  const g = grade.trim().toUpperCase();
  if (['F', 'NP', 'U', 'FA', 'W'].includes(g)) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let rawText = '';
    const parsedCourses: ParsedCourse[] = [];

    // 1. 파일 업로드 또는 텍스트/JSON 분기 수신
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const textParam = formData.get('text') as string | null;

      if (textParam) {
        rawText = textParam;
      } else if (file) {
        const fileName = file.name.toLowerCase();
        const buffer = await file.arrayBuffer();

        // 엑셀 파일(.xlsx, .xls) 직접 파싱
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          // 행 단위 탭 구분 텍스트로 변환
          rawText = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
        } else {
          rawText = new TextDecoder('utf-8').decode(buffer);
        }
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      rawText = body.text || body.content || '';
    } else {
      rawText = await req.text();
    }

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: '성적표 데이터가 비어 있거나 텍스트를 추출할 수 없습니다.' },
        { status: 422 }
      );
    }

    // 2. 라인별 텍스트 파싱
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // 공백 정규식 매칭 패턴 (년도, 학기, 과목명, 구분, 학점, 등급)
    const tableRowRegex = /^(?:(\d{4})[-.\s년]*)?(?:(\d|1학기|2학기|여름|겨울|하계|동계)학기?)?\s*([가-힣A-Za-z0-9_·()\s]{2,40})\s+(전필|전선|전기|전공|복필|복선|복전|부전|교직|교필|교선|일선|기교|심교|균형)\s+(\d(?:\.\d)?)\s+([A-D][+]?|F|P|NP|S|U)/i;

    for (const line of lines) {
      // 탭(\t) 구분 텍스트 우선 처리 (엑셀 변환문 및 포털 드래그 복사 대응)
      const tabCols = line.split('\t').map((c) => c.trim()).filter(Boolean);

      if (tabCols.length >= 4) {
        const creditIdx = tabCols.findIndex((c) => /^\d(\.0)?$/.test(c));
        const gradeIdx = tabCols.findIndex((c) => /^[A-D][+]?$|^[FPNSU]$/i.test(c));

        if (creditIdx !== -1 && gradeIdx !== -1 && creditIdx < tabCols.length) {
          const courseName = tabCols[creditIdx - 2] || tabCols[0];
          const rawCat = tabCols[creditIdx - 1] || '전선';
          const credit = parseFloat(tabCols[creditIdx]);
          const grade = tabCols[gradeIdx].toUpperCase();

          if (courseName && !isNaN(credit)) {
            parsedCourses.push({
              course_name: courseName.replace(/^[0-9-]+\s*/, ''),
              credit,
              raw_category: rawCat,
              category: normalizeCategory(rawCat),
              grade,
              is_passed: checkIsPassed(grade),
            });
            continue;
          }
        }
      }

      // 공백 정규식 파싱
      const match = line.match(tableRowRegex);
      if (match) {
        const [, year, semester, courseName, rawCategory, credit, grade] = match;
        const normalizedGrade = grade.toUpperCase();

        parsedCourses.push({
          year: year ? parseInt(year, 10) : undefined,
          semester: semester ? semester : undefined,
          course_name: courseName.trim(),
          raw_category: rawCategory.trim(),
          category: normalizeCategory(rawCategory),
          credit: parseFloat(credit),
          grade: normalizedGrade,
          is_passed: checkIsPassed(normalizedGrade),
        });
      }
    }

    if (parsedCourses.length === 0) {
      return NextResponse.json(
        {
          error: '성적표에서 교과목 목록을 인식하지 못했습니다. 포털 성적 내역을 텍스트로 직접 복사하거나 올바른 파일을 첨부하십시오.',
          preview: lines.slice(0, 10),
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      courses: parsedCourses,
      totalCount: parsedCourses.length,
    });
  } catch (error: unknown) {
    console.error('[/api/parse-transcript] 서버 처리 예외:', error);
    return NextResponse.json(
      { error: '성적표 파싱 처리 중 서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}