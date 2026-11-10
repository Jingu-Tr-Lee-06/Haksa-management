import { generateContentWithVisionFallback } from './fallback';
import { CourseCategory, GradeType, SemesterType } from '@/types/database.types';

export interface ExtractedCourseRow {
  courseName: string;
  category: CourseCategory;
  credits: number;
  grade: GradeType;
  gradePoint: number;
  takenYear: number;
  takenSemester: SemesterType;
  isMajorCourse: boolean;
  isTeachingCourse: boolean;
}

export interface VisionParsingResult {
  success: boolean;
  courses: ExtractedCourseRow[];
  modelUsed?: string;
  rawResponse?: string;
  errorMessage?: string;
}

const GRADE_POINTS_MAP: Record<GradeType, number> = {
  'A+': 4.5,
  'A0': 4.0,
  'B+': 3.5,
  'B0': 3.0,
  'C+': 2.5,
  'C0': 2.0,
  'D+': 1.5,
  'D0': 1.0,
  'F': 0.0,
  'P': 0.0,
  'S': 0.0,
  'U': 0.0,
};

const VALID_CATEGORIES: CourseCategory[] = [
  '전공기초',
  '전공핵심',
  '전공심화',
  '기본이수',
  '교과교육',
  '기초교양필수',
  '기초교양선택',
  '균형교양',
  '일반선택',
  '교직이론',
  '교직소양',
  '교직실습',
];

// 사범대 교과교육 3대 영역
const PEDAGOGY_KEYWORDS = [
  '교과교육론',
  '교과교재연구및지도법',
  '교재연구및지도법',
  '교과논리및논술',
  '논리및논술',
];

// 교직소양 과목군
const TEACHING_APTITUDE_KEYWORDS = [
  '특수교육학개론',
  '교직실무',
  '학교폭력예방및학생의이해',
  '학교폭력예방',
];

// 교직실습 과목군
const TEACHING_PRACTICE_KEYWORDS = [
  '학교현장실습',
  '교육실습',
  '교육봉사활동',
  '교육봉사',
];

/**
 * 과목명을 기반으로 사범대 전공/교직 세부 카테고리를 자동 보정한다.
 */
function refineCategoryByCourseName(courseName: string, defaultCategory: CourseCategory): CourseCategory {
  const normalized = courseName.replace(/\s+/g, '');

  if (PEDAGOGY_KEYWORDS.some((kw) => normalized.includes(kw.replace(/\s+/g, '')))) {
    return '교과교육';
  }

  if (TEACHING_PRACTICE_KEYWORDS.some((kw) => normalized.includes(kw.replace(/\s+/g, '')))) {
    return '교직실습';
  }

  if (TEACHING_APTITUDE_KEYWORDS.some((kw) => normalized.includes(kw.replace(/\s+/g, '')))) {
    return '교직소양';
  }

  return defaultCategory;
}

/**
 * 성적 등급 문자열을 규격화한다.
 */
function normalizeGrade(gradeStr: string): GradeType {
  const g = String(gradeStr || 'P').trim().toUpperCase();
  if (['A+', 'B+', 'C+', 'D+'].includes(g)) return g as GradeType;
  if (g === 'A' || g === 'A0') return 'A0';
  if (g === 'B' || g === 'B0') return 'B0';
  if (g === 'C' || g === 'C0') return 'C0';
  if (g === 'D' || g === 'D0') return 'D0';
  if (g === 'F') return 'F';
  if (g === 'S') return 'S';
  if (g === 'U') return 'U';
  return 'P';
}

/**
 * 성적표 이미지 Base64 데이터를 전달받아 Gemini Vision을 통해 과목 내역을 추출한다.
 */
export async function parseTranscriptImage(
  base64Image: string,
  mimeType: string
): Promise<VisionParsingResult> {
  const systemInstruction = `당신은 국립공주대학교 사범대학 성적증명서 및 포털 성적조회 화면을 정밀 판독하는 OCR 데이터 분석 엔진이다.
이미지에 기재된 모든 기이수 교과목 행(Row)을 빠짐없이 식별하고 규격화된 JSON 배열 형식으로만 응답하라.
마크다운 코드블록이나 주석, 부연설명 없이 오직 순수한 JSON 문자열만 출력해야 한다.`;

  const prompt = `제공된 대학교 성적표 이미지에서 이수한 모든 교과목 목록을 추출하라.

[추출 필드 규격]
- courseName: 성적표에 기재된 정확한 교과목명 (문자열)
- category: 다음 카테고리 중 가장 부합하는 값 매핑 (문자열)
  ['전공기초', '전공핵심', '전공심화', '기본이수', '교과교육', '기초교양필수', '기초교양선택', '균형교양', '일반선택', '교직이론', '교직소양', '교직실습']
  * 성적표의 '전필', '전선'은 전공 범주로 분류.
  * '교육론', '교재연구', '논리및논술'이 포함된 과목은 '교과교육'으로 분류.
  * '특수교육학개론', '교직실무', '학교폭력예방'은 '교직소양'으로 분류.
  * '교육실습', '학교현장실습', '교육봉사'는 '교직실습'으로 분류.
  * '교육학개론', '교육철학', '교육심리', '교육사회' 등 일반 교직은 '교직이론'으로 분류.
- credits: 이수 학점 (숫자, 예: 3.0, 2.0, 1.0)
- grade: 취득 성적 등급 (예: A+, A0, B+, B0, C+, C0, D+, F, P)
- takenYear: 이수 연도 (4자리 정수, 예: 2025)
- takenSemester: 이수 학기 ('1학기', '2학기', '하계학기', '동계학기' 중 하나)

[응답 예시]
[
  {
    "courseName": "프로그래밍 1",
    "category": "전공기초",
    "credits": 3.0,
    "grade": "A+",
    "takenYear": 2025,
    "takenSemester": "1학기"
  }
]`;

  try {
    const fallbackResult = await generateContentWithVisionFallback(
      prompt,
      base64Image,
      mimeType,
      systemInstruction
    );

    // 응답 문자열에서 JSON 배열 블록만 정밀 추출
    const text = fallbackResult.text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('응답 데이터에서 유효한 JSON 배열 형식을 찾을 수 없습니다.');
    }

    const parsedArray = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsedArray)) {
      throw new Error('파싱된 결과가 배열 형태가 아닙니다.');
    }

    const courses: ExtractedCourseRow[] = parsedArray.map((row: any) => {
      const courseName = String(row.courseName || '미지정과목').trim();
      const grade = normalizeGrade(row.grade);
      const gradePoint = GRADE_POINTS_MAP[grade] ?? 0.0;

      let category: CourseCategory = '일반선택';
      if (VALID_CATEGORIES.includes(row.category)) {
        category = row.category;
      } else if (row.category?.includes('전공') || row.category?.includes('전선') || row.category?.includes('전필')) {
        category = '전공핵심';
      } else if (row.category?.includes('교양') || row.category?.includes('교선')) {
        category = '균형교양';
      } else if (row.category?.includes('교필')) {
        category = '기초교양필수';
      } else if (row.category?.includes('교직')) {
        category = '교직이론';
      }

      // 과목명 기반 사범대 세부 영역 2차 보정
      category = refineCategoryByCourseName(courseName, category);

      const isMajor = [
        '전공기초',
        '전공핵심',
        '전공심화',
        '기본이수',
        '교과교육',
      ].includes(category);

      const isTeaching = [
        '교직이론',
        '교직소양',
        '교직실습',
      ].includes(category);

      let takenSemester: SemesterType = '1학기';
      const semStr = String(row.takenSemester || '');
      if (['1학기', '2학기', '하계학기', '동계학기'].includes(semStr)) {
        takenSemester = semStr as SemesterType;
      } else if (semStr.includes('여름') || semStr.includes('하계')) {
        takenSemester = '하계학기';
      } else if (semStr.includes('겨울') || semStr.includes('동계')) {
        takenSemester = '동계학기';
      } else if (semStr.includes('2')) {
        takenSemester = '2학기';
      }

      return {
        courseName,
        category,
        credits: Number(row.credits) || 3.0,
        grade,
        gradePoint,
        takenYear: Number(row.takenYear) || new Date().getFullYear(),
        takenSemester,
        isMajorCourse: isMajor,
        isTeachingCourse: isTeaching,
      };
    });

    return {
      success: true,
      courses,
      modelUsed: fallbackResult.modelUsed,
      rawResponse: fallbackResult.text,
    };
  } catch (error) {
    return {
      success: false,
      courses: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}