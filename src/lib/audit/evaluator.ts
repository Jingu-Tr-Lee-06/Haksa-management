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

// 컴퓨터교육과 기본이수 지정 과목군 (7개 분야 이상 이수 필수)
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
  '정보통신윤리',
];

// 컴퓨터교육과 교과교육영역 지정 과목군 (3과목 8학점 필수)
const PEDAGOGY_SUBJECTS = [
  '정보교과교육론',
  '정보교과교재연구및지도법',
  '정보교과논리및논술',
];

// 기초교양필수 지정 과목군
const BASIC_REQUIRED_GE_COURSES = [
  '비판적사고와소통',
  'Communication in English(L&R) I',
  'Communication in English(S&W) I',
  '컴퓨팅적사고',
  'SW와문제해결',
  '대학생활과미래설계',
];

/**
 * 교양 이수 내역을 사정한다.
 * - 단일전공(심화): 교양 총 24학점 이상 (기초필수 12학점, 균형교양 12학점 이상)
 * - 사범계 복수전공: 교양 최소 18학점 이상 (균형교양 최소 8학점 포함)
 */
export function evaluateGeneralEducation(
  courses: UserCompletedCourse[],
  isTrackDoubleMajor: boolean
): GeneralEducationAuditResult {
  const geCourses = courses.filter((c) =>
    ['기초교양필수', '기초교양선택', '균형교양', '교양'].includes(c.category)
  );

  const totalEarnedCredits = geCourses.reduce((sum, c) => sum + Number(c.credits), 0);
  const requiredTotal = isTrackDoubleMajor ? 18.0 : 24.0;

  // 기초교양필수 이수 여부 점검
  const completedNames = geCourses.map((c) => c.courseName);
  const basicCompleted = BASIC_REQUIRED_GE_COURSES.filter((req) =>
    completedNames.some((cName) => cName.replace(/\s+/g, '') === req.replace(/\s+/g, ''))
  );
  const basicMissing = BASIC_REQUIRED_GE_COURSES.filter((req) =>
    !completedNames.some((cName) => cName.replace(/\s+/g, '') === req.replace(/\s+/g, ''))
  );

  const basicEarnedCredits = geCourses
    .filter((c) => c.category === '기초교양필수')
    .reduce((sum, c) => sum + Number(c.credits), 0);

  // 균형교양 이수 학점
  const balancedEarnedCredits = geCourses
    .filter((c) => c.category === '균형교양')
    .reduce((sum, c) => sum + Number(c.credits), 0);

  const balancedRequiredCredits = isTrackDoubleMajor ? 8.0 : 12.0;

  return {
    requiredCredits: requiredTotal,
    earnedCredits: totalEarnedCredits,
    isSatisfied:
      totalEarnedCredits >= requiredTotal &&
      balancedEarnedCredits >= balancedRequiredCredits &&
      basicMissing.length === 0,
    basicRequired: {
      requiredCredits: 12.0,
      earnedCredits: basicEarnedCredits,
      completedCourseNames: basicCompleted,
      missingCourseNames: basicMissing,
      isSatisfied: basicMissing.length === 0,
    },
    balancedRequired: {
      requiredCredits: balancedRequiredCredits,
      earnedCredits: balancedEarnedCredits,
      isSatisfied: balancedEarnedCredits >= balancedRequiredCredits,
    },
  };
}

/**
 * 전공 이수 내역을 사정한다.
 * - 단일전공: 75학점 이상 (기본이수 21학점, 교과교육 8학점, 전공기초 21학점 포함)
 * - 사범계 복수전공: 각 50학점 이상 (기본이수 21학점, 교과교육 8학점 포함)
 */
export function evaluateMajor(
  courses: UserCompletedCourse[],
  majorName: string,
  isTrackDoubleMajor: boolean
): MajorAuditResult {
  const majorCourses = courses.filter((c) =>
    ['전공기초', '전공핵심', '전공심화', '기본이수', '교과교육', '전공선택', '전공필수'].includes(c.category)
  );

  const totalEarned = majorCourses.reduce((sum, c) => sum + Number(c.credits), 0);
  const requiredCredits = isTrackDoubleMajor ? 50.0 : 75.0;

  // 전공기초
  const basicMajorEarned = majorCourses
    .filter((c) => c.category === '전공기초')
    .reduce((sum, c) => sum + Number(c.credits), 0);

  // 전공핵심 및 전공심화
  const coreAndAdvancedEarned = majorCourses
    .filter((c) => ['전공핵심', '전공심화', '전공선택', '전공필수'].includes(c.category))
    .reduce((sum, c) => sum + Number(c.credits), 0);

  // 기본이수과목군 판정
  const completedMajorNames = majorCourses.map((c) => c.courseName);
  const matchedStandardSubjects = STANDARD_REQUIRED_SUBJECTS.filter((req) =>
    completedMajorNames.some((cName) => cName.replace(/\s+/g, '').includes(req.replace(/\s+/g, '')))
  );
  const uniqueStandardMatches = Array.from(new Set(matchedStandardSubjects));
  const isStandardSatisfied = uniqueStandardMatches.length >= 7;

  // 교과교육영역 판정 (3과목 8학점)
  const pedagogyCourses = majorCourses.filter((c) => c.category === '교과교육');
  const pedagogyCredits = pedagogyCourses.reduce((sum, c) => sum + Number(c.credits), 0);
  const completedPedagogy = PEDAGOGY_SUBJECTS.filter((req) =>
    completedMajorNames.some((cName) => cName.replace(/\s+/g, '') === req.replace(/\s+/g, ''))
  );
  const missingPedagogy = PEDAGOGY_SUBJECTS.filter((req) =>
    !completedMajorNames.some((cName) => cName.replace(/\s+/g, '') === req.replace(/\s+/g, ''))
  );
  const isPedagogySatisfied = pedagogyCredits >= 8.0 && missingPedagogy.length === 0;

  return {
    track: isTrackDoubleMajor ? 'DOUBLE_MAJOR' : 'SINGLE_MAJOR',
    majorName,
    requiredCredits,
    earnedCredits: totalEarned,
    isSatisfied:
      totalEarned >= requiredCredits &&
      isStandardSatisfied &&
      isPedagogySatisfied &&
      basicMajorEarned >= (isTrackDoubleMajor ? 15.0 : 21.0),
    basicMajor: {
      requiredCredits: isTrackDoubleMajor ? 15.0 : 21.0,
      earnedCredits: basicMajorEarned,
      isSatisfied: basicMajorEarned >= (isTrackDoubleMajor ? 15.0 : 21.0),
    },
    coreAndAdvanced: {
      requiredCredits: isTrackDoubleMajor ? 27.0 : 46.0,
      earnedCredits: coreAndAdvancedEarned,
      isSatisfied: coreAndAdvancedEarned >= (isTrackDoubleMajor ? 27.0 : 46.0),
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
 * - 교직이론 12학점(6과목), 교직소양 6학점(3과목), 교육실습 4학점(학교현장실습+교육봉사) = 총 22학점
 * - 비교과: 적성인성 2회, 응급처치 2회, 성인지 4회, 교육봉사 60시간(2학점), 마약류 검사(음성), 한국사 3급 이상
 */
export function evaluateTeaching(
  courses: UserCompletedCourse[],
  nonSubject: UserNonSubjectRecords
): TeachingAuditResult {
  const teachingCourses = courses.filter((c) =>
    ['교직이론', '교직소양', '교직실습'].includes(c.category)
  );

  const theoryCredits = teachingCourses
    .filter((c) => c.category === '교직이론')
    .reduce((sum, c) => sum + Number(c.credits), 0);

  const aptitudeCredits = teachingCourses
    .filter((c) => c.category === '교직소양')
    .reduce((sum, c) => sum + Number(c.credits), 0);

  const practiceCredits = teachingCourses
    .filter((c) => c.category === '교직실습')
    .reduce((sum, c) => sum + Number(c.credits), 0);

  const totalTeachingCredits = theoryCredits + aptitudeCredits + practiceCredits;

  const nonSubjectSatisfied =
    nonSubject.genderEquityEducationCount >= 4 &&
    nonSubject.teachingAptitudeTestCount >= 2 &&
    nonSubject.cprTrainingCount >= 2 &&
    nonSubject.volunteerHours >= 60.0 &&
    nonSubject.narcoticsTestSubmitted &&
    nonSubject.koreanHistoryCertified;

  return {
    requiredCredits: 22.0,
    earnedCredits: totalTeachingCredits,
    isSatisfied:
      theoryCredits >= 12.0 &&
      aptitudeCredits >= 6.0 &&
      practiceCredits >= 4.0 &&
      nonSubjectSatisfied,
    theory: {
      requiredCredits: 12.0,
      earnedCredits: theoryCredits,
      isSatisfied: theoryCredits >= 12.0,
    },
    aptitude: {
      requiredCredits: 6.0,
      earnedCredits: aptitudeCredits,
      isSatisfied: aptitudeCredits >= 6.0,
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
    const totalCredits = list.reduce((sum, c) => sum + Number(c.credits), 0);
    if (totalCredits === 0) return 0.0;
    const totalPoints = list.reduce((sum, c) => sum + Number(c.credits) * Number(c.gradePoint), 0);
    return Math.round((totalPoints / totalCredits) * 100) / 100;
  };

  const majorCourses = gradedCourses.filter((c) =>
    ['전공기초', '전공핵심', '전공심화', '기본이수', '교과교육', '전공선택', '전공필수'].includes(c.category)
  );

  const teachingCourses = gradedCourses.filter((c) =>
    ['교직이론', '교직소양', '교직실습'].includes(c.category)
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
 * - 이수학기: 6학기 또는 7학기
 * - 전 학년 누적 평점평균: 4.00 이상
 * - 졸업 요건 학점 완비 및 징계 사실 없음
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
  // 복수전공 여부 판별
  const isDoubleMajor = Boolean(
    profile.track === 'DOUBLE_MAJOR' ||
    profile.double_major ||
    (profile as any).is_double_major
  );

  // 사범대 기준: 단일심화 140학점 / 사범계 복수전공 144학점
  const totalRequiredCredits = isDoubleMajor ? 144.0 : 140.0;
  const totalEarnedCredits = courses.reduce((sum, c) => sum + Number(c.credits), 0);

  const geResult = evaluateGeneralEducation(courses, isDoubleMajor);
  const primaryMajorResult = evaluateMajor(courses, profile.primary_major, isDoubleMajor);
  const doubleMajorResult = isDoubleMajor && profile.double_major
    ? evaluateMajor(courses, profile.double_major, true)
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
    geResult.isSatisfied &&
    primaryMajorResult.isSatisfied &&
    (!doubleMajorResult || doubleMajorResult.isSatisfied) &&
    teachingResult.isSatisfied &&
    gpaResult.isMajorGpaSatisfied &&
    gpaResult.isTeachingGpaSatisfied;

  return {
    userId: profile.id,
    studentNumber: profile.student_number || '',
    studentName: profile.name || '',
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