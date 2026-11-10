import { MajorTrackType } from './database.types';

export interface AuditCategoryProgress {
  categoryName: string;
  requiredCredits: number;
  earnedCredits: number;
  isSatisfied: boolean;
  details?: string[];
}

export interface GeneralEducationAuditResult {
  requiredCredits: number;
  earnedCredits: number;
  isSatisfied: boolean;
  basicRequired: {
    requiredCredits: number;
    earnedCredits: number;
    completedCourseNames: string[];
    missingCourseNames: string[];
    isSatisfied: boolean;
  };
  balancedRequired: {
    requiredCredits: number;
    earnedCredits: number;
    isSatisfied: boolean;
    areaCoverage?: {
      areaA: boolean;
      areaB: boolean;
      areaC: boolean;
    };
  };
}

export interface MajorAuditResult {
  track: MajorTrackType;
  majorName: string;
  requiredCredits: number;
  earnedCredits: number;
  isSatisfied: boolean;
  basicMajor: {
    requiredCredits: number;
    earnedCredits: number;
    isSatisfied: boolean;
  };
  coreAndAdvanced: {
    requiredCredits: number;
    earnedCredits: number;
    isSatisfied: boolean;
  };
  standardRequiredCourses: {
    requiredCourseCount: number;
    completedCourseCount: number;
    completedCourses: string[];
    missingCourses: string[];
    isSatisfied: boolean;
  };
  pedagogyCourses: {
    requiredCourseCount: number;
    requiredCredits: number;
    completedCredits: number;
    completedCourses: string[];
    missingCourses: string[];
    isSatisfied: boolean;
  };
}

export interface TeachingAuditResult {
  requiredCredits: number;
  earnedCredits: number;
  isSatisfied: boolean;
  theory: {
    requiredCredits: number; // 12학점 (6과목)
    earnedCredits: number;
    isSatisfied: boolean;
  };
  aptitude: {
    requiredCredits: number; // 8학점 (4과목)
    earnedCredits: number;
    isSatisfied: boolean;
  };
  practice: {
    requiredCredits: number; // 4학점 (현장실습 2 + 교육봉사 2)
    earnedCredits: number;
    isSatisfied: boolean;
  };
  nonSubject: {
    genderEquityEducationSatisfied: boolean; // 연 1회, 총 4회
    teachingAptitudeTestSatisfied: boolean;   // 총 2회 적격
    cprTrainingSatisfied: boolean;            // 총 2회 이수
    volunteerHoursSatisfied: boolean;         // 총 60시간
    narcoticsTestSatisfied: boolean;          // 판정지 제출
    koreanHistoryCertified: boolean;          // 3급 이상
    isAllSatisfied: boolean;
  };
}

export interface GpaAuditResult {
  totalGpa: number;
  majorGpa: number;       // 전공 75점(2.01) 이상 필수
  teachingGpa: number;    // 교직 80점(2.51) 이상 필수
  isMajorGpaSatisfied: boolean;
  isTeachingGpaSatisfied: boolean;
}

export interface EarlyGraduationCheckResult {
  isEligible: boolean;
  currentCompletedSemesters: number;
  totalEarnedCredits: number;
  cumulativeGpa: number; // 4.00 이상 필수
  criteriaFailures: string[];
}

export interface FullAuditReport {
  userId: string;
  studentNumber: string;
  studentName: string;
  track: MajorTrackType;
  admissionYear: number;
  totalRequiredCredits: number;
  totalEarnedCredits: number;
  isTotalCreditsSatisfied: boolean;
  generalEducation: GeneralEducationAuditResult;
  primaryMajor: MajorAuditResult;
  doubleMajor?: MajorAuditResult;
  teaching: TeachingAuditResult;
  gpa: GpaAuditResult;
  earlyGraduation: EarlyGraduationCheckResult;
  isReadyForGraduation: boolean;
}