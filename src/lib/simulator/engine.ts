// src/lib/simulator/engine.ts
import { CourseCategory, SemesterType } from '@/types/database.types';
import { MajorTrack, getCollegeOfEducationRequirements } from '@/types/curriculum';

export interface PlannedCourseItem {
  id: string;
  courseCode?: string;
  courseName: string;
  category: CourseCategory | string;
  credits: number;
  timetable?: string;
  classroom?: string;
  professorName?: string;
  isSeasonalCourse: boolean;
}

export interface SemesterPlanState {
  targetYear: number;
  targetSemester: SemesterType;
  baseMaxCredits: number;
  carriedOverCredits: number;
  enrolledCredits: number;
  maxAllowedCredits: number;
  isSeasonal: boolean;
  courses: PlannedCourseItem[];
}

// 사범대학 공통 학점 상한 규격 (기본 18 / 우수 21 / 최대 24 / 계절 6)
export const KNU_COLLEGE_OF_EDUCATION_RULE = {
  regularBaseCredits: 18.0,
  highGpaBonusCredits: 3.0, // 4.0 이상 우수 시 21.0
  maxCarryOverCredits: 3.0, // 직전학기 잔여 이월 시 최대 24.0 (21 + 3)
  seasonalMaxCredits: 6.0,  // 계절학기 최대 6.0
};

// 컴퓨터교육과 전공필수 7과목 정규화 목록 (21학점)
export const MANDATORY_MAJOR_COURSES = [
  '프로그래밍',
  '자료구조',
  '컴퓨터구조',
  '알고리즘',
  '정보윤리교육개론',
  '운영체제',
  '정보교과교육론',
];

// 전체 학기 플랜 재계산 (이월학점 연쇄 계산 및 성적우수 한도 부여)
export function recalculateAllPlans(
  plans: SemesterPlanState[],
  highGpaFlags: Record<string, boolean>
): SemesterPlanState[] {
  let previousRemainingRegular = 0;

  return plans.map((plan) => {
    const key = `${plan.targetYear}-${plan.targetSemester}`;
    const isHighGpa = Boolean(highGpaFlags[key]);

    if (plan.isSeasonal) {
      const enrolled = plan.courses.reduce((sum, c) => sum + Number(c.credits || 0), 0);
      return {
        ...plan,
        baseMaxCredits: KNU_COLLEGE_OF_EDUCATION_RULE.seasonalMaxCredits,
        carriedOverCredits: 0,
        maxAllowedCredits: KNU_COLLEGE_OF_EDUCATION_RULE.seasonalMaxCredits,
        enrolledCredits: enrolled,
      };
    }

    // 정규학기: 기본 18학점 + 우수 3학점 = 21학점
    const base = isHighGpa
      ? KNU_COLLEGE_OF_EDUCATION_RULE.regularBaseCredits + KNU_COLLEGE_OF_EDUCATION_RULE.highGpaBonusCredits
      : KNU_COLLEGE_OF_EDUCATION_RULE.regularBaseCredits;

    // 직전 정규학기에서 못 쓴 학점 이월 (최대 3학점) -> 성적우수 시 최대 24학점까지 도달
    const carriedOver = Math.min(
      previousRemainingRegular,
      KNU_COLLEGE_OF_EDUCATION_RULE.maxCarryOverCredits
    );
    const maxAllowed = base + carriedOver;
    const enrolled = plan.courses.reduce((sum, c) => sum + Number(c.credits || 0), 0);

    // 다음 정규학기로 넘겨줄 잔여학점 (기본 18학점 기준 미신청 잔여량)
    previousRemainingRegular = Math.max(
      0,
      KNU_COLLEGE_OF_EDUCATION_RULE.regularBaseCredits - enrolled
    );

    return {
      ...plan,
      baseMaxCredits: base,
      carriedOverCredits: carriedOver,
      maxAllowedCredits: maxAllowed,
      enrolledCredits: enrolled,
    };
  });
}

// 과목 추가 검증
export function validateAddCourseToPlan(
  plan: SemesterPlanState,
  courseCredits: number
): { valid: boolean; reason?: string } {
  if (plan.enrolledCredits + courseCredits > plan.maxAllowedCredits) {
    return {
      valid: false,
      reason: `해당 학기 최대 허용 학점(${plan.maxAllowedCredits.toFixed(1)}학점)을 초과할 수 없습니다. (현재 신청: ${plan.enrolledCredits.toFixed(1)}학점)`,
    };
  }
  return { valid: true };
}

// ==========================================
// 시뮬레이터 실시간 잔여 학점 및 요건 진척도 분석
// ==========================================

export interface SimulationProgressSummary {
  track: MajorTrack;
  totalPlannedCredits: number;
  totalRequiredCredits: number;
  isTotalSatisfied: boolean;
  
  // 영역별 세부 학점
  majorRequired: { earned: number; required: number; isSatisfied: boolean; fulfilledCourses: string[] };
  majorElective: { earned: number; required: number; isSatisfied: boolean };
  teaching: { earned: number; required: number; isSatisfied: boolean };
  generalEducation: { earned: number; required: number; isSatisfied: boolean };
  secondaryMajor?: { earned: number; required: number; isSatisfied: boolean };

  // 필수 요건
  hasPassedCapstone2: boolean;
  canGraduate: boolean;
}

function normalizeName(name: string): string {
  return (name || '').replace(/[*△▲◆◇\s]/g, '');
}

/**
 * 기이수 과목과 시뮬레이터에 등록된 수강계획 과목을 통합하여
 * 졸업 요건 충족 여부를 실시간 산출합니다.
 */
export function calculateSimulationProgress(
  allCourses: Array<{ courseName: string; category: string; credits: number }>,
  track: MajorTrack = 'SINGLE',
  secondaryMajorName?: string | null
): SimulationProgressSummary {
  const req = getCollegeOfEducationRequirements({
    primaryMajorName: '컴퓨터교육과',
    track,
    secondaryMajorName: secondaryMajorName || '',
  });

  const totalCredits = allCourses.reduce((sum, c) => sum + Number(c.credits || 0), 0);

  // 1. 캡스톤디자인Ⅱ 판정
  const hasPassedCapstone2 = allCourses.some((c) => {
    const norm = normalizeName(c.courseName);
    return norm.includes('캡스톤디자인2') || norm.includes('캡스톤디자인Ⅱ');
  });

  // 2. 전공필수 7과목 (21학점)
  const fulfilledRequiredList: string[] = [];
  let majorReqCredits = 0;

  MANDATORY_MAJOR_COURSES.forEach((target) => {
    const matched = allCourses.find((c) =>
      !c.category.includes('복수') &&
      !c.category.includes('부전') &&
      normalizeName(c.courseName).includes(normalizeName(target))
    );
    if (matched) {
      fulfilledRequiredList.push(target);
      majorReqCredits += Number(matched.credits || 3);
    }
  });

  const isMajorReqSatisfied = fulfilledRequiredList.length === MANDATORY_MAJOR_COURSES.length && majorReqCredits >= 21;

  // 3. 전공선택 학점 (콜라주 제외, 순수 전선 합산: 단일 51 / 복수 30)
  const majorElectiveCredits = allCourses
    .filter((c) => {
      const isMajor = c.category.includes('전선') || c.category.includes('전공선택') || c.category.includes('전공핵심') || c.category.includes('전공심화');
      const isMandatory = MANDATORY_MAJOR_COURSES.some((t) =>
        normalizeName(c.courseName).includes(normalizeName(t))
      );
      return isMajor && !isMandatory && !c.category.includes('복수') && !c.category.includes('부전');
    })
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const isMajorElectiveSatisfied = majorElectiveCredits >= req.primaryDetails.coreAdvanced;

  // 4. 교직 24학점 (이론 12 + 소양 8 + 실습 4)
  const teachingCredits = allCourses
    .filter((c) => {
      const isEduTheory =
        c.courseName.includes('교재연구') ||
        c.courseName.includes('정보윤리교육') ||
        c.courseName.includes('논술');
      if (isEduTheory) return false;

      return (
        c.category.includes('교직') ||
        c.category.includes('일반교육학') ||
        c.category.includes('교실') ||
        c.category.includes('일교') ||
        [
          '교육평가', '교육학개론', '교육사회', '교육행정및교육경영', '디지털교육',
          '생활지도와상담', '교육봉사Ⅰ', '교육봉사 I', '교육봉사Ⅱ', '교육봉사 II',
          '특수교육학개론', '교육방법및교육공학', '교육과정', '교직실무', '학교현장실습'
        ].some((k) => c.courseName.includes(k))
      );
    })
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const isTeachingSatisfied = teachingCredits >= req.teachingTheoryRequired;

  // 5. 교양 영역 (단일 36 / 복수 18)
  const geCredits = allCourses
    .filter((c) => c.category.includes('교양') || c.category.includes('균형') || c.category.includes('기초'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const isGeSatisfied = geCredits >= req.generalEducationRequiredCredits;

  // 6. 복수/부전공 (복수 50 / 부전공 21)
  let secondarySummary = undefined;
  if (track !== 'SINGLE') {
    const secCredits = allCourses
      .filter((c) => {
        if (track === 'DOUBLE') return c.category.includes('복수') || c.category.includes('복필') || c.category.includes('복선');
        if (track === 'MINOR') return c.category.includes('부전') || c.category.includes('부필') || c.category.includes('부선');
        return false;
      })
      .reduce((sum, c) => sum + Number(c.credits || 0), 0);

    secondarySummary = {
      earned: secCredits,
      required: req.secondaryRequiredCredits,
      isSatisfied: secCredits >= req.secondaryRequiredCredits,
    };
  }

  const isTotalSatisfied = totalCredits >= req.totalRequiredCredits;
  const canGraduate =
    isTotalSatisfied &&
    hasPassedCapstone2 &&
    isMajorReqSatisfied &&
    isMajorElectiveSatisfied &&
    isTeachingSatisfied &&
    isGeSatisfied &&
    (!secondarySummary || secondarySummary.isSatisfied);

  return {
    track,
    totalPlannedCredits: totalCredits,
    totalRequiredCredits: req.totalRequiredCredits,
    isTotalSatisfied,
    majorRequired: {
      earned: majorReqCredits,
      required: 21,
      isSatisfied: isMajorReqSatisfied,
      fulfilledCourses: fulfilledRequiredList,
    },
    majorElective: {
      earned: majorElectiveCredits,
      required: req.primaryDetails.coreAdvanced,
      isSatisfied: isMajorElectiveSatisfied,
    },
    teaching: {
      earned: teachingCredits,
      required: req.teachingTheoryRequired,
      isSatisfied: isTeachingSatisfied,
    },
    generalEducation: {
      earned: geCredits,
      required: req.generalEducationRequiredCredits,
      isSatisfied: isGeSatisfied,
    },
    ...(secondarySummary ? { secondaryMajor: secondarySummary } : {}),
    hasPassedCapstone2,
    canGraduate,
  };
}