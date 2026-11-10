export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MajorTrackType = 'SINGLE_MAJOR' | 'DOUBLE_MAJOR';

export type SemesterType = '1학기' | '2학기' | '하계학기' | '동계학기';

export type TargetSemesterType = SemesterType | '전학기';

export type CourseCategory =
  | '전공기초'
  | '전공핵심'
  | '전공심화'
  | '기본이수'
  | '교과교육'
  | '기초교양필수'
  | '기초교양선택'
  | '균형교양'
  | '일반선택'
  | '교직이론'
  | '교직소양'
  | '교직실습';

export type GradeType =
  | 'A+'
  | 'A0'
  | 'B+'
  | 'B0'
  | 'C+'
  | 'C0'
  | 'D+'
  | 'D0'
  | 'F'
  | 'P'
  | 'S'
  | 'U';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          student_number: string | null;
          name: string | null;
          primary_major: string;
          double_major: string | null;
          track: MajorTrackType;
          admission_year: number;
          target_graduation_semester: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          student_number?: string | null;
          name?: string | null;
          primary_major?: string;
          double_major?: string | null;
          track?: MajorTrackType;
          admission_year?: number;
          target_graduation_semester?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_number?: string | null;
          name?: string | null;
          primary_major?: string;
          double_major?: string | null;
          track?: MajorTrackType;
          admission_year?: number;
          target_graduation_semester?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      courses: {
        Row: {
          id: string;
          course_code: string | null;
          course_name: string;
          department: string;
          target_year: number;
          target_semester: TargetSemesterType;
          category: CourseCategory;
          credits: number;
          is_custom_created: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_code?: string | null;
          course_name: string;
          department?: string;
          target_year: number;
          target_semester: TargetSemesterType;
          category: CourseCategory;
          credits?: number;
          is_custom_created?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_code?: string | null;
          course_name?: string;
          department?: string;
          target_year?: number;
          target_semester?: TargetSemesterType;
          category?: CourseCategory;
          credits?: number;
          is_custom_created?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
      };
      seasonal_open_courses: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          season: '하계학기' | '동계학기';
          course_name: string;
          category: string;
          credits: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          year: number;
          season: '하계학기' | '동계학기';
          course_name: string;
          category: string;
          credits?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          year?: number;
          season?: '하계학기' | '동계학기';
          course_name?: string;
          category?: string;
          credits?: number;
          created_at?: string;
        };
      };
      user_completed_courses: {
        Row: {
          id: string;
          user_id: string;
          course_name: string;
          category: CourseCategory;
          credits: number;
          grade: GradeType;
          grade_point: number;
          taken_year: number;
          taken_semester: SemesterType;
          is_major_course: boolean;
          is_teaching_course: boolean;
          is_retaken: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_name: string;
          category: CourseCategory;
          credits?: number;
          grade: GradeType;
          grade_point?: number;
          taken_year: number;
          taken_semester: SemesterType;
          is_major_course?: boolean;
          is_teaching_course?: boolean;
          is_retaken?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          course_name?: string;
          category?: CourseCategory;
          credits?: number;
          grade?: GradeType;
          grade_point?: number;
          taken_year?: number;
          taken_semester?: SemesterType;
          is_major_course?: boolean;
          is_teaching_course?: boolean;
          is_retaken?: boolean;
          created_at?: string;
        };
      };
      user_non_subject_records: {
        Row: {
          user_id: string;
          gender_equity_education_count: number;
          teaching_aptitude_test_count: number;
          cpr_training_count: number;
          volunteer_hours: number;
          narcotics_test_submitted: boolean;
          korean_history_certified: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          gender_equity_education_count?: number;
          teaching_aptitude_test_count?: number;
          cpr_training_count?: number;
          volunteer_hours?: number;
          narcotics_test_submitted?: boolean;
          korean_history_certified?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          gender_equity_education_count?: number;
          teaching_aptitude_test_count?: number;
          cpr_training_count?: number;
          volunteer_hours?: number;
          narcotics_test_submitted?: boolean;
          korean_history_certified?: boolean;
          updated_at?: string;
        };
      };
      semester_plans: {
        Row: {
          id: string;
          user_id: string;
          target_year: number;
          target_semester: SemesterType;
          max_credits_limit: number;
          carried_over_credits: number;
          is_early_graduation_target: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_year: number;
          target_semester: SemesterType;
          max_credits_limit?: number;
          carried_over_credits?: number;
          is_early_graduation_target?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          target_year?: number;
          target_semester?: SemesterType;
          max_credits_limit?: number;
          carried_over_credits?: number;
          is_early_graduation_target?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      planned_courses: {
        Row: {
          id: string;
          plan_id: string;
          course_name: string;
          category: CourseCategory;
          credits: number;
          is_seasonal_course: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          course_name: string;
          category: CourseCategory;
          credits?: number;
          is_seasonal_course?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          course_name?: string;
          category?: CourseCategory;
          credits?: number;
          is_seasonal_course?: boolean;
          created_at?: string;
        };
      };
    };
  };
}