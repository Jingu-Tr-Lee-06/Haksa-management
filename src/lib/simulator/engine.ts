import { CourseCategory, SemesterType } from '@/types/database.types';

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
      const enrolled = plan.courses.reduce((sum, c) => sum + c.credits, 0);
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
    const enrolled = plan.courses.reduce((sum, c) => sum + c.credits, 0);

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