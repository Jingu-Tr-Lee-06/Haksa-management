import { CourseCategory, GradeType, SemesterType, TargetSemesterType } from './database.types';

export interface Course {
  id: string;
  courseCode?: string | null;
  courseName: string;
  department: string;
  targetYear: number;
  targetSemester: TargetSemesterType;
  category: CourseCategory;
  credits: number;
  isCustomCreated?: boolean;
  createdBy?: string | null;
}

export interface SeasonalOpenCourse {
  id: string;
  userId: string;
  year: number;
  season: '하계학기' | '동계학기';
  courseName: string;
  category: string;
  credits: number;
}

export interface UserCompletedCourse {
  id: string;
  userId: string;
  courseName: string;
  category: CourseCategory;
  credits: number;
  grade: GradeType;
  gradePoint: number;
  takenYear: number;
  takenSemester: SemesterType;
  isMajorCourse: boolean;
  isTeachingCourse: boolean;
  isRetaken: boolean;
}

export interface UserNonSubjectRecords {
  userId: string;
  genderEquityEducationCount: number; // 0 ~ 4회
  teachingAptitudeTestCount: number;   // 0 ~ 2회
  cprTrainingCount: number;            // 0 ~ 2회
  volunteerHours: number;              // 누적 교육봉사 시간
  narcoticsTestSubmitted: boolean;     // 마약류 검사 결과 제출
  koreanHistoryCertified: boolean;     // 한국사능력검정시험 3급 이상 인증
}

export interface ParsedCurriculumRow {
  targetYear: number;
  targetSemester: '1학기' | '2학기';
  courseName: string;
  category: CourseCategory;
  credits: number;
}