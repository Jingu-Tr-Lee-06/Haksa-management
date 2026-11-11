import { UserCompletedCourse, UserNonSubjectRecords } from '@/types/course';
import {
  FullAuditReport,
  GeneralEducationAuditResult,
  MajorAuditResult,
  TeachingAuditResult,
  GpaAuditResult,
  EarlyGraduationCheckResult,
} from '@/types/audit';
import { Database } from '@/types/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

// 컴퓨터교육과 전공필수(기본이수) 7개 필수과목 (전원 이수 21학점 필수)
const MANDATORY_MAJOR_REQUIRED = [
  '프로그래밍',
  '자료구조',
  '컴퓨터구조',
  '알고리즘',
  '정보윤리교육개론',
  '운영체제',
  '정보교과교육론',
];

// 컴퓨터교육과 기본이수 지정 과목군
const STANDARD_REQUIRED_SUBJECTS = [
  '데이터베이스',
  '데이터통신',
  '데이터통신과네트워크',
  '컴퓨터구조',
  '운영체제',
  '프로그래밍',
  '프로그래밍 1',
  '프로그래밍 2',
  '이산수학',
  '자료구조',
  '알고리즘',
  '소프트웨어공학',
  '인공지능',
  '정보윤리교육개론',
  '정보통신윤리',
];

// 컴퓨터교육과 교과교육영역 지정 과목군 (3과목 8학점 필수)
const PEDAGOGY_SUBJECTS = [
  '정보교과교육론',
  '정보교과교재연구',
  '정보논리논술개론',
];

// 문자열 정규화 헬퍼 (공백 및 특수문자 제거)
function normalizeName(name: string): string {
  return (name || '').replace(/[*△▲◆◇\s]/g, '');
}

/**
 * 교양 이수 내역을 사정한다.
 * - 단일/부전공: 균형교양 선택 12학점(3개 영역 이상) 포함 총 36학점 이상
 * - 사범계 복수전공: 균형교양 선택 8학점 포함 총 18학점 이상 (교양 감면 기준)
 */
export function evaluateGeneralEducation(
  courses: UserCompletedCourse[],
  track: 'SINGLE' | 'DOUBLE' | 'MINOR'
): GeneralEducationAuditResult {
  const geCourses = courses.filter((c) =>
    ['기초교양필수', '기초교양선택', '균형교양', '일반교양', '교양'].some((k) =>
      c.category?.includes(k)
    )
  );

  const totalEarnedCredits = geCourses.reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const requiredTotal = track === 'DOUBLE' ? 18.0 : 36.0;

  // 균형교양 학점 및 영역 집계
  const balancedCourses = geCourses.filter((c) =>
    c.category?.includes('균형') || (c as any).subCategory?.includes('균형')
  );
  const balancedEarnedCredits = balancedCourses.reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const balancedRequiredCredits = track === 'DOUBLE' ? 8.0 : 12.0;

  const balancedAreas = new Set(
    balancedCourses.map((c) => (c as any).subCategory || (c as any).area || '균형영역')
  );

  const isAreaSatisfied = track === 'DOUBLE' ? true : balancedAreas.size >= 3;
  const isSatisfied =
    totalEarnedCredits >= requiredTotal &&
    balancedEarnedCredits >= balancedRequiredCredits &&
    isAreaSatisfied;

  return {
    requiredCredits: requiredTotal,
    earnedCredits: totalEarnedCredits,
    isSatisfied,
    basicRequired: {
      requiredCredits: track === 'DOUBLE' ? 10.0 : 10.0,
      earnedCredits: geCourses
        .filter((c) => c.category?.includes('기초교양'))
        .reduce((sum, c) => sum + Number(c.credits || 0), 0),
      completedCourseNames: geCourses.map((c) => c.courseName),
      missingCourseNames: [],
      isSatisfied: true,
    },
    balancedRequired: {
      requiredCredits: balancedRequiredCredits,
      earnedCredits: balancedEarnedCredits,
      isSatisfied: balancedEarnedCredits >= balancedRequiredCredits && isAreaSatisfied,
    },
  };
}

/**
 * 전공 이수 내역을 사정한다.
 * - 단일전공: 72학점 이상 (전공필수 21학점 7과목 필수 + 전공선택 51학점 이상)
 * - 사범계 복수/부전공: 전공필수 21학점 + 전공선택 30학점 이상
 * - 공통: 캡스톤디자인 2 졸업 필수
 */
export function evaluateMajor(
  courses: UserCompletedCourse[],
  majorName: string,
  track: 'SINGLE' | 'DOUBLE' | 'MINOR'
): MajorAuditResult & { hasPassedCapstone2: boolean } {
  const majorCourses = courses.filter((c) =>
    ['전공기초', '전공핵심', '전공심화', '기본이수', '교과교육', '전공선택', '전공필수', '전선', '전필'].some((k) =>
      c.category?.includes(k)
    )
  );

  const totalEarned = majorCourses.reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const requiredCredits = track === 'SINGLE' ? 72.0 : 51.0;

  const completedMajorNames = majorCourses.map((c) => c.courseName);

  // 1. 캡스톤디자인 2 졸업 요건 판정
  const hasPassedCapstone2 = completedMajorNames.some((name) => {
    const norm = normalizeName(name);
    return norm.includes('캡스톤디자인2') || norm.includes('캡스톤디자인Ⅱ');
  });

  // 2. 전공필수 (기본 7과목 21학점) 판정
  const missingMandatoryRequired: string[] = [];
  let majorReqCredits = 0;

  MANDATORY_MAJOR_REQUIRED.forEach((target) => {
    const matched = majorCourses.find((c) =>
      normalizeName(c.courseName).includes(normalizeName(target))
    );
    if (matched) {
      majorReqCredits += Number(matched.credits || 3);
    } else {
      missingMandatoryRequired.push(target);
    }
  });

  const isMandatoryReqSatisfied = majorReqCredits >= 21.0 && missingMandatoryRequired.length === 0;

  // 3. 전공선택 학점 판정 (단일 51학점, 복수/부 30학점 이상)
  const requiredElectiveCredits = track === 'SINGLE' ? 51.0 : 30.0;
  const majorElectiveCredits = majorCourses
    .filter((c) => {
      const isReq = MANDATORY_MAJOR_REQUIRED.some((req) =>
        normalizeName(c.courseName).includes(normalizeName(req))
      );
      return !isReq;
    })
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  // 4. 기본이수 7개 분야 판정
  const matchedStandardSubjects = STANDARD_REQUIRED_SUBJECTS.filter((req) =>
    completedMajorNames.some((cName) => normalizeName(cName).includes(normalizeName(req)))
  );
  const uniqueStandardMatches = Array.from(new Set(matchedStandardSubjects));
  const isStandardSatisfied = uniqueStandardMatches.length >= 7;

  // 5. 교과교육 3과목 8학점 판정
  const pedagogyCourses = majorCourses.filter((c) =>
    PEDAGOGY_SUBJECTS.some((req) => normalizeName(c.courseName).includes(normalizeName(req)))
  );
  const pedagogyCredits = pedagogyCourses.reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const completedPedagogy = PEDAGOGY_SUBJECTS.filter((req) =>
    completedMajorNames.some((cName) => normalizeName(cName).includes(normalizeName(req)))
  );
  const missingPedagogy = PEDAGOGY_SUBJECTS.filter((req) =>
    !completedMajorNames.some((cName) => normalizeName(cName).includes(normalizeName(req)))
  );
  const isPedagogySatisfied = pedagogyCredits >= 8.0 && missingPedagogy.length === 0;

  return {
    track: track === 'DOUBLE' ? 'DOUBLE_MAJOR' : 'SINGLE_MAJOR',
    majorName,
    requiredCredits,
    earnedCredits: totalEarned,
    hasPassedCapstone2,
    isSatisfied:
      totalEarned >= requiredCredits &&
      isMandatoryReqSatisfied &&
      majorElectiveCredits >= requiredElectiveCredits &&
      isStandardSatisfied &&
      isPedagogySatisfied &&
      hasPassedCapstone2,
    basicMajor: {
      requiredCredits: 21.0,
      earnedCredits: majorReqCredits,
      isSatisfied: isMandatoryReqSatisfied,
    },
    coreAndAdvanced: {
      requiredCredits: requiredElectiveCredits,
      earnedCredits: majorElectiveCredits,
      isSatisfied: majorElectiveCredits >= requiredElectiveCredits,
    },
    standardRequiredCourses: {
      requiredCourseCount: 7,
      completedCourseCount: uniqueStandardMatches.length,
      completedCourses: uniqueStandardMatches,
      missingCourses: STANDARD_REQUIRED_SUBJECTS.filter(
        (s) => !uniqueStandardMatches.includes(s)
      ),
      isSatisfied: isStandardSatisfied,
    },
    pedagogyCourses: {
      requiredCourseCount: 3,
      requiredCredits: 8.0,
      completedCredits: pedagogyCredits,
      completedCourses: completedPedagogy,
      missingCourses: missingPedagogy,
      isSatisfied: isPedagogySatisfied,
    },
  };
}

/**
 * 교직과정 및 교원자격 무시험검정 요건을 사정한다.
 * - 교직이론 12학점(6과목), 교직소양 8학점(4과목), 교육실습 4학점(현장실습+봉사) = 총 24학점
 */
export function evaluateTeaching(
  courses: UserCompletedCourse[],
  nonSubject: UserNonSubjectRecords
): TeachingAuditResult {
  const teachingCourses = courses.filter((c) =>
    ['교직이론', '교직소양', '교직실습', '교직'].some((k) => c.category?.includes(k))
  );

  const theoryCredits = teachingCourses
    .filter((c) => c.category?.includes('이론') || (c as any).subCategory?.includes('이론'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const aptitudeCredits = teachingCourses
    .filter((c) => c.category?.includes('소양') || (c as any).subCategory?.includes('소양'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const practiceCredits = teachingCourses
    .filter((c) =>
      c.category?.includes('실습') ||
      c.courseName.includes('실습') ||
      c.courseName.includes('봉사')
    )
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const totalTeachingCredits = theoryCredits + aptitudeCredits + practiceCredits;

  const nonSubjectSatisfied =
    nonSubject.genderEquityEducationCount >= 4 &&
    nonSubject.teachingAptitudeTestCount >= 2 &&
    nonSubject.cprTrainingCount >= 2 &&
    nonSubject.volunteerHours >= 60.0 &&
    nonSubject.narcoticsTestSubmitted &&
    nonSubject.koreanHistoryCertified;

  return {
    requiredCredits: 24.0,
    earnedCredits: totalTeachingCredits,
    isSatisfied:
      theoryCredits >= 12.0 &&
      aptitudeCredits >= 8.0 &&
      practiceCredits >= 4.0 &&
      totalTeachingCredits >= 24.0 &&
      nonSubjectSatisfied,
    theory: {
      requiredCredits: 12.0,
      earnedCredits: theoryCredits,
      isSatisfied: theoryCredits >= 12.0,
    },
    aptitude: {
      requiredCredits: 8.0,
      earnedCredits: aptitudeCredits,
      isSatisfied: aptitudeCredits >= 8.0,
    },
    practice: {
      requiredCredits: 4.0,
      earnedCredits: practiceCredits,
      isSatisfied: practiceCredits >= 4.0,
    },
    nonSubject: {
      genderEquityEducationSatisfied: nonSubject.genderEquityEducationCount >= 4,
      teachingAptitudeTestSatisfied: nonSubject.teachingAptitudeTestCount >= 2,
      cprTrainingSatisfied: nonSubject.cprTrainingCount >= 2,
      volunteerHoursSatisfied: nonSubject.volunteerHours >= 60.0,
      narcoticsTestSatisfied: nonSubject.narcoticsTestSubmitted,
      koreanHistoryCertified: nonSubject.koreanHistoryCertified,
      isAllSatisfied: nonSubjectSatisfied,
    },
  };
}

/**
 * 전공 및 교직 평점 환산 및 기준 충족 여부를 계산한다.
 * - 전공: 75점 이상 (평점 2.01 이상)
 * - 교직: 80점 이상 (평점 2.51 이상)
 */
export function evaluateGpa(courses: UserCompletedCourse[]): GpaAuditResult {
  const gradedCourses = courses.filter((c) => c.grade !== 'P' && c.grade !== 'S' && c.grade !== 'U');

  const calculateAverage = (list: UserCompletedCourse[]) => {
    const totalCredits = list.reduce((sum, c) => sum + Number(c.credits || 0), 0);
    if (totalCredits === 0) return 0.0;
    const totalPoints = list.reduce((sum, c) => sum + Number(c.credits || 0) * Number(c.gradePoint || 0), 0);
    return Math.round((totalPoints / totalCredits) * 100) / 100;
  };

  const majorCourses = gradedCourses.filter((c) =>
    ['전공기초', '전공핵심', '전공심화', '기본이수', '교과교육', '전공선택', '전공필수', '전선', '전필'].some((k) =>
      c.category?.includes(k)
    )
  );

  const teachingCourses = gradedCourses.filter((c) =>
    ['교직이론', '교직소양', '교직실습', '교직'].some((k) => c.category?.includes(k))
  );

  const totalGpa = calculateAverage(gradedCourses);
  const majorGpa = calculateAverage(majorCourses);
  const teachingGpa = calculateAverage(teachingCourses);

  return {
    totalGpa,
    majorGpa,
    teachingGpa,
    isMajorGpaSatisfied: majorGpa >= 2.01,
    isTeachingGpaSatisfied: teachingGpa >= 2.51,
  };
}

/**
 * 조기졸업 자격 요건을 진단한다.
 */
export function evaluateEarlyGraduation(
  totalEarnedCredits: number,
  totalRequiredCredits: number,
  cumulativeGpa: number,
  completedSemestersCount: number
): EarlyGraduationCheckResult {
  const criteriaFailures: string[] = [];

  if (completedSemestersCount < 6 || completedSemestersCount > 7) {
    criteriaFailures.push('조기졸업 가능 학기 범위(6~7학기)에 해당하지 않습니다.');
  }

  if (cumulativeGpa < 4.0) {
    criteriaFailures.push('전 학년 누적 평점평균 4.00 요건에 미달합니다.');
  }

  if (totalEarnedCredits < totalRequiredCredits) {
    criteriaFailures.push(`졸업 총 소요 학점(${totalRequiredCredits}학점)을 충족하지 못했습니다.`);
  }

  return {
    isEligible: criteriaFailures.length === 0,
    currentCompletedSemesters: completedSemestersCount,
    totalEarnedCredits,
    cumulativeGpa,
    criteriaFailures,
  };
}

/**
 * 종합 졸업 사정 리포트를 생성한다.
 */
export function generateFullAuditReport(
  profile: ProfileRow,
  courses: UserCompletedCourse[],
  nonSubject: UserNonSubjectRecords,
  completedSemestersCount: number = 7
): FullAuditReport {
  // 트랙 정규화
  const rawTrack = String((profile as any).major_track || profile.track || 'SINGLE');
  const track: 'SINGLE' | 'DOUBLE' | 'MINOR' = rawTrack.includes('DOUBLE')
    ? 'DOUBLE'
    : rawTrack.includes('MINOR')
    ? 'MINOR'
    : 'SINGLE';

  const isDoubleMajor = track === 'DOUBLE';
  const totalRequiredCredits = isDoubleMajor ? 144.0 : 140.0;
  const totalEarnedCredits = courses.reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const geResult = evaluateGeneralEducation(courses, track);
  const primaryMajorResult = evaluateMajor(courses, profile.primary_major, track);
  
  const secMajorName = (profile as any).secondary_major || profile.double_major;
  const doubleMajorResult = isDoubleMajor && secMajorName
    ? evaluateMajor(courses, secMajorName, 'DOUBLE')
    : undefined;

  const teachingResult = evaluateTeaching(courses, nonSubject);
  const gpaResult = evaluateGpa(courses);

  const earlyGradResult = evaluateEarlyGraduation(
    totalEarnedCredits,
    totalRequiredCredits,
    gpaResult.totalGpa,
    completedSemestersCount
  );

  const isReady =
    totalEarnedCredits >= totalRequiredCredits &&
    primaryMajorResult.hasPassedCapstone2 &&
    geResult.isSatisfied &&
    primaryMajorResult.isSatisfied &&
    (!doubleMajorResult || doubleMajorResult.isSatisfied) &&
    teachingResult.isSatisfied &&
    gpaResult.isMajorGpaSatisfied &&
    gpaResult.isTeachingGpaSatisfied;

  return {
    userId: profile.id,
    studentNumber: (profile as any).student_id || profile.student_number || '',
    studentName: (profile as any).full_name || profile.name || '',
    track: isDoubleMajor ? 'DOUBLE_MAJOR' : 'SINGLE_MAJOR',
    admissionYear: profile.admission_year,
    totalRequiredCredits,
    totalEarnedCredits,
    isTotalCreditsSatisfied: totalEarnedCredits >= totalRequiredCredits,
    generalEducation: geResult,
    primaryMajor: primaryMajorResult,
    doubleMajor: doubleMajorResult,
    teaching: teachingResult,
    gpa: gpaResult,
    earlyGraduation: earlyGradResult,
    isReadyForGraduation: isReady,
  };
}