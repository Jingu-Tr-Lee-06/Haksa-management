// src/app/curriculum/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database, GradeType, SemesterType } from '@/types/database.types';
import ExcelUploadModal from '@/components/curriculum/ExcelUploadModal';
import EnrolledUploadModal from '@/components/curriculum/EnrolledUploadModal';
import OfferedUploadModal from '@/components/curriculum/OfferedUploadModal';

type CompletedCourseRow = Database['public']['Tables']['user_completed_courses']['Row'];
type NonSubjectRow = Database['public']['Tables']['user_non_subject_records']['Row'];

interface EnrolledCourseRow {
  id: string;
  course_code: string | null;
  course_name: string;
  category: string;
  credits: number;
  professor: string | null;
  classroom: string | null;
  timetable: string | null;
  is_major_course: boolean;
  is_teaching_course: boolean;
}

interface UserProfile {
  id: string;
  name: string;
  student_number: string;
  primary_major: string;
  track: 'SINGLE_MAJOR' | 'DOUBLE_MAJOR' | 'MINOR';
  major_track?: 'SINGLE' | 'DOUBLE' | 'MINOR';
  double_major: string | null;
  minor_major: string | null;
  secondary_major: string | null;
  admission_year: number;
}

const COURSE_CATEGORIES: string[] = [
  '전공기초',
  '전공핵심',
  '전공심화',
  '전공필수',
  '전공선택',
  '복수전공필수',
  '복수전공선택',
  '부전공필수',
  '부전공선택',
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

const GRADE_TYPES: GradeType[] = [
  'A+', 'A0', 'B+', 'B0', 'C+', 'C0', 'D+', 'D0', 'F', 'P', 'S', 'U',
];

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

export default function CurriculumPage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [courses, setCourses] = useState<CompletedCourseRow[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourseRow[]>([]);
  const [nonSubject, setNonSubject] = useState<NonSubjectRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 모달 제어 상태
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isEnrolledModalOpen, setIsEnrolledModalOpen] = useState(false);
  const [isOfferedModalOpen, setIsOfferedModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 수동 등록 폼 상태
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [category, setCategory] = useState<string>('전공기초');
  const [credits, setCredits] = useState<number>(3.0);
  const [grade, setGrade] = useState<GradeType>('A+');
  const [takenYear, setTakenYear] = useState<number>(new Date().getFullYear());
  const [takenSemester, setTakenSemester] = useState<SemesterType>('1학기');

  // 데이터 로드
  const loadData = async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      setUserId(user.id);

      const [profileRes, coursesRes, enrolledRes, nonSubjectRes] = await Promise.all([
        (supabase.from('profiles') as any)
          .select('*')
          .eq('id', user.id)
          .maybeSingle(),
        (supabase.from('user_completed_courses') as any)
          .select('*')
          .eq('user_id', user.id)
          .order('taken_year', { ascending: false })
          .order('taken_semester', { ascending: false }),
        (supabase.from('user_enrolled_courses') as any)
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
        (supabase.from('user_non_subject_records') as any)
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const rawDb = (profileRes.data || {}) as Record<string, any>;
      const meta = (user.user_metadata || {}) as Record<string, any>;

      // 1순위: DB profiles.track 최우선 적용
      const dbTrackStr = String(rawDb.track || rawDb.major_track || '').toUpperCase();
      const metaTrackStr = String(meta.major_track || meta.track || '').toUpperCase();
      const targetTrackStr = dbTrackStr || metaTrackStr;

      let resolvedTrack: 'SINGLE_MAJOR' | 'DOUBLE_MAJOR' | 'MINOR' = 'SINGLE_MAJOR';
      if (targetTrackStr.includes('DOUBLE')) {
        resolvedTrack = 'DOUBLE_MAJOR';
      } else if (targetTrackStr.includes('MINOR')) {
        resolvedTrack = 'MINOR';
      }

      const secMajor =
        rawDb.secondary_major ||
        rawDb.double_major ||
        rawDb.minor_major ||
        meta.secondary_major ||
        meta.double_major ||
        meta.minor_major ||
        null;

      const unifiedProfile: UserProfile = {
        id: user.id,
        name: rawDb.full_name || rawDb.name || meta.full_name || meta.name || '학생',
        student_number: rawDb.student_id || rawDb.student_number || meta.student_id || meta.student_number || '',
        primary_major: rawDb.primary_major || meta.primary_major || '컴퓨터교육과',
        track: resolvedTrack,
        major_track: resolvedTrack === 'DOUBLE_MAJOR' ? 'DOUBLE' : resolvedTrack === 'MINOR' ? 'MINOR' : 'SINGLE',
        double_major: resolvedTrack === 'DOUBLE_MAJOR' ? secMajor : null,
        minor_major: resolvedTrack === 'MINOR' ? secMajor : null,
        secondary_major: secMajor,
        admission_year: rawDb.admission_year || meta.admission_year || 2025,
      };

      setProfile(unifiedProfile);

      if (coursesRes.data) {
        setCourses(coursesRes.data);
      }

      if (enrolledRes.data) {
        setEnrolledCourses(enrolledRes.data as EnrolledCourseRow[]);
      }

      if (nonSubjectRes.data) {
        setNonSubject(nonSubjectRes.data);
      } else {
        setNonSubject({
          user_id: user.id,
          gender_equity_education_count: 0,
          teaching_aptitude_test_count: 0,
          cpr_training_count: 0,
          volunteer_hours: 0,
          narcotics_test_submitted: false,
          korean_history_certified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as NonSubjectRow);
      }
    } catch (err) {
      console.error('데이터 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 이수구분 변경 헬퍼 (플래그 동시 업데이트)
  const computeCourseFlags = (cat: string) => {
    const isMajor = [
      '전공기초', '전공핵심', '전공심화', '전공필수', '전공선택',
      '복수전공필수', '복수전공선택', '부전공필수', '부전공선택',
      '기본이수', '교과교육',
    ].some((k) => cat.includes(k));

    const isTeaching = [
      '교직이론', '교직소양', '교직실습', '일반교육학', '교직과목',
    ].some((k) => cat.includes(k));

    return { isMajor, isTeaching };
  };

  // 1. 기이수 과목 이수구분 변경 및 DB 반영
  const handleUpdateCompletedCategory = async (courseId: string, newCategory: string) => {
    const { isMajor, isTeaching } = computeCourseFlags(newCategory);

    setCourses((prev) =>
      prev.map((c) =>
        c.id === courseId
          ? ({
              ...c,
              category: newCategory,
              is_major_course: isMajor,
              is_teaching_course: isTeaching,
            } as CompletedCourseRow)
          : c
      )
    );

    try {
      const { error } = await (supabase.from('user_completed_courses') as any)
        .update({
          category: newCategory,
          is_major_course: isMajor,
          is_teaching_course: isTeaching,
        })
        .eq('id', courseId);

      if (error) throw error;
      setNotification({ type: 'success', message: '기이수 과목의 이수구분이 변경되었습니다.' });
    } catch (err: any) {
      console.error('이수구분 변경 실패:', err);
      setNotification({ type: 'error', message: err.message || '이수구분 저장 실패' });
      await loadData();
    }
  };

  // 2. 현재 수강 중 과목 이수구분 변경 및 DB 반영
  const handleUpdateEnrolledCategory = async (courseId: string, newCategory: string) => {
    const { isMajor, isTeaching } = computeCourseFlags(newCategory);

    setEnrolledCourses((prev) =>
      prev.map((c) =>
        c.id === courseId
          ? {
              ...c,
              category: newCategory,
              is_major_course: isMajor,
              is_teaching_course: isTeaching,
            }
          : c
      )
    );

    try {
      const { error } = await (supabase.from('user_enrolled_courses') as any)
        .update({
          category: newCategory,
          is_major_course: isMajor,
          is_teaching_course: isTeaching,
        })
        .eq('id', courseId);

      if (error) throw error;
      setNotification({ type: 'success', message: '현재 수강 중인 과목의 이수구분이 변경되었습니다.' });
    } catch (err: any) {
      console.error('수강 과목 이수구분 변경 실패:', err);
      setNotification({ type: 'error', message: err.message || '이수구분 저장 실패' });
      await loadData();
    }
  };

  // 수동 단일 과목 추가
  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim()) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { isMajor, isTeaching } = computeCourseFlags(category);

      const payload = {
        user_id: user.id,
        course_code: courseCode.trim() || null,
        course_name: courseName.trim(),
        category,
        credits,
        grade,
        grade_point: GRADE_POINTS_MAP[grade],
        taken_year: takenYear,
        taken_semester: takenSemester,
        is_major_course: isMajor,
        is_teaching_course: isTeaching,
        is_retaken: false,
      };

      const { error } = await (supabase.from('user_completed_courses') as any).insert(payload);

      if (error) throw error;

      setCourseCode('');
      setCourseName('');
      await loadData();
      setNotification({ type: 'success', message: '교과목이 성공적으로 추가되었습니다.' });
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : '과목 추가 실패',
      });
    }
  };

  // 과목 삭제
  const handleDeleteCourse = async (id: string) => {
    if (!confirm('해당 교과목을 삭제하시겠습니까?')) return;

    try {
      const { error } = await (supabase.from('user_completed_courses') as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCourses((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  // 수강 과목 개별 삭제
  const handleDeleteEnrolledCourse = async (id: string) => {
    if (!confirm('수강 중인 과목 목록에서 제외하시겠습니까?')) return;

    try {
      const { error } = await (supabase.from('user_enrolled_courses') as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      setEnrolledCourses((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  // 기이수 과목 전체 초기화
  const handleResetAllCourses = async () => {
    if (!userId) return;
    if (!confirm('등록된 모든 기이수 성적 내역을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    const { error } = await (supabase.from('user_completed_courses') as any)
      .delete()
      .eq('user_id', userId);

    if (!error) {
      await loadData();
    }
  };

  // 수강 과목 전체 초기화
  const handleResetEnrolledCourses = async () => {
    if (!userId) return;
    if (!confirm('등록된 현재 학기 수강과목 내역을 비우시겠습니까?')) return;

    const { error } = await (supabase.from('user_enrolled_courses') as any)
      .delete()
      .eq('user_id', userId);

    if (!error) {
      await loadData();
    }
  };

  // 비교과 이력 갱신
  const handleUpdateNonSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nonSubject) return;

    try {
      const updatePayload = {
        user_id: nonSubject.user_id,
        gender_equity_education_count: nonSubject.gender_equity_education_count,
        teaching_aptitude_test_count: nonSubject.teaching_aptitude_test_count,
        cpr_training_count: nonSubject.cpr_training_count,
        volunteer_hours: nonSubject.volunteer_hours,
        narcotics_test_submitted: nonSubject.narcotics_test_submitted,
        korean_history_certified: nonSubject.korean_history_certified,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase.from('user_non_subject_records') as any)
        .upsert(updatePayload, { onConflict: 'user_id' });

      if (error) throw error;
      setNotification({ type: 'success', message: '비교과 검정 이력이 정상 저장되었습니다.' });
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : '비교과 갱신 실패',
      });
    }
  };

  // 트랙별 동적 변수
  const isDoubleMajor = profile?.track === 'DOUBLE_MAJOR';
  const isMinor = profile?.track === 'MINOR';
  const hasSecondMajor = isDoubleMajor || isMinor;

  const targetGraduationCredits = isDoubleMajor ? 144 : 140;
  const reqGeTotalCredits = isDoubleMajor ? 18 : 36;
  const reqBalanceGeCredits = isDoubleMajor ? 8 : 12;

  const dynamicSecondName = profile?.secondary_major || profile?.double_major || profile?.minor_major;
  const secondMajorHeaderLabel = isDoubleMajor
    ? dynamicSecondName ? `복수전공 (${dynamicSecondName})` : '복수전공'
    : dynamicSecondName ? `부전공 (${dynamicSecondName})` : '부전공';

  const reqSecondMajorCredits = isDoubleMajor ? 50 : 21;

  // 1. 기이수 학점 계산
  const completedTotalCredits = courses.reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const completedPrimaryMajorCourses = courses.filter(
    (c) =>
      !c.category.includes('복수') &&
      !c.category.includes('부전') &&
      (c.is_major_course ||
        ['전공', '전선', '전필', '전기', '전공기초', '전공핵심', '전공심화', '기본이수', '교과교육'].some(
          (k) => c.category.includes(k)
        ))
  );
  const completedPrimaryCredits = completedPrimaryMajorCourses.reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const completedPrimaryBasic = completedPrimaryMajorCourses
    .filter((c) => c.category.includes('기초') || c.category.includes('전기') || c.category.includes('전필'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const completedPrimaryElective = completedPrimaryMajorCourses
    .filter((c) => c.category.includes('선택') || c.category.includes('심화') || c.category.includes('핵심') || c.category.includes('전선'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const completedSecondCourses = courses.filter((c) =>
    isDoubleMajor ? c.category.includes('복수') : c.category.includes('부전')
  );
  const completedSecondCredits = completedSecondCourses.reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const completedSecondReq = completedSecondCourses
    .filter((c) => c.category.includes('필수') || c.category.includes('기본이수'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const completedSecondEle = completedSecondCourses
    .filter((c) => c.category.includes('선택') || !c.category.includes('필수'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const completedTeachingCredits = courses
    .filter(
      (c) =>
        c.is_teaching_course ||
        ['교직', '일반교육학', '교실', '일교', '교소'].some((k) => c.category.includes(k))
    )
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const completedBasicGe = courses
    .filter((c) => c.category.includes('교양필수') || c.category.includes('기초교양'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const completedBalanceGe = courses
    .filter((c) => c.category.includes('교양선택') || c.category.includes('균형교양') || c.category.includes('균선'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const completedGeTotal = completedBasicGe + completedBalanceGe;
  const completedGeneralEle = courses
    .filter((c) => c.category.includes('일반선택') || c.category.includes('융합탐색') || c.category.includes('자선') || c.category.includes('일선'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  // 2. 현재 수강 중 학점 계산
  const enrolledTotalCredits = enrolledCourses.reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const enrolledPrimaryCourses = enrolledCourses.filter(
    (c) =>
      !c.category.includes('복수') &&
      !c.category.includes('부전') &&
      (c.is_major_course ||
        ['전공', '전선', '전필', '전공기초'].some((k) => c.category.includes(k)))
  );
  const enrolledPrimaryCredits = enrolledPrimaryCourses.reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const enrolledPrimaryBasic = enrolledPrimaryCourses
    .filter((c) => c.category.includes('기초') || c.category.includes('전필'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const enrolledPrimaryElective = enrolledPrimaryCourses
    .filter((c) => c.category.includes('선택') || c.category.includes('전선'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const enrolledSecondCourses = enrolledCourses.filter((c) =>
    isDoubleMajor ? c.category.includes('복수') : c.category.includes('부전')
  );
  const enrolledSecondCredits = enrolledSecondCourses.reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const enrolledSecondReq = enrolledSecondCourses
    .filter((c) => c.category.includes('필수') || c.category.includes('기본이수'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const enrolledSecondEle = enrolledSecondCourses
    .filter((c) => c.category.includes('선택') || !c.category.includes('필수'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const enrolledTeachingCredits = enrolledCourses
    .filter(
      (c) =>
        c.is_teaching_course ||
        ['교직', '일반교육학', '교실', '일교', '교소'].some((k) => c.category.includes(k))
    )
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  const enrolledGeCredits = enrolledCourses
    .filter((c) => c.category.includes('교양') || c.category.includes('균선'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const enrolledGeneralEle = enrolledCourses
    .filter((c) => c.category.includes('일선') || c.category.includes('일반선택'))
    .reduce((sum, c) => sum + Number(c.credits || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 flex-1 w-full">
        {/* 상단 타이틀 및 액션 바 */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              CURRICULUM MANAGEMENT
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              학사 이수 및 수강 현황 관리
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {profile?.name} | 주전공: {profile?.primary_major || '컴퓨터교육과'} 
              {isDoubleMajor && ` · ${secondMajorHeaderLabel} (복수전공 144학점 체계 · 교양 18학점 감면)`}
              {isMinor && ` · ${secondMajorHeaderLabel} (부전공 140학점 체계 · 제2전공 21학점 이상)`}
              {!hasSecondMajor && ' (단일전공 140학점 체계 · 전공 72학점 이상)'}
            </p>
          </div>

          {/* 엑셀 관리 액션 버튼 그룹 */}
          <div className="flex flex-wrap items-center gap-2">
            {courses.length > 0 && (
              <button
                onClick={handleResetAllCourses}
                className="rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
              >
                기이수 초기화
              </button>
            )}
            <button
              onClick={() => setIsExcelModalOpen(true)}
              className="rounded bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              누적성적 엑셀 업로드
            </button>
            <button
              onClick={() => setIsEnrolledModalOpen(true)}
              className="rounded bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600"
            >
              수강과목 엑셀 업로드
            </button>
            <button
              onClick={() => setIsOfferedModalOpen(true)}
              className="rounded border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              개설강좌 엑셀 등록
            </button>
          </div>
        </div>

        {notification && (
          <div
            className={`mt-4 rounded border p-3 text-xs ${
              notification.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {notification.message}
          </div>
        )}

        {/* 포털 학사 이수기준표 연동 통합 대조 분석표 */}
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              공주대학교 학사 이수기준표 대조 분석 ({isDoubleMajor ? '복수전공 기준: 144학점' : '단일·부전공 기준: 140학점'})
            </h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500">
                기이수: <strong className="text-slate-900">{completedTotalCredits.toFixed(1)}</strong>학점
              </span>
              <span className="text-blue-600 font-semibold">
                + 수강 중: <strong>{enrolledTotalCredits.toFixed(1)}</strong>학점
              </span>
              <span className="rounded bg-slate-100 px-2.5 py-1 font-bold text-slate-900">
                이수 시 합산: {(completedTotalCredits + enrolledTotalCredits).toFixed(1)} / {targetGraduationCredits}학점
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border border-slate-200 text-center text-xs">
              <thead className="bg-slate-50 text-slate-700">
                <tr className="border-b border-slate-200 text-[11px]">
                  <th rowSpan={3} className="border-r border-slate-200 px-3 py-2">구분</th>
                  <th colSpan={3} className="border-r border-slate-200 py-1.5">
                    교양 {isDoubleMajor ? '(감면 18학점)' : '(36학점)'}
                  </th>
                  <th colSpan={3} className="border-r border-slate-200 py-1.5">
                    주전공 ({profile?.primary_major || '컴퓨터교육과'})
                  </th>
                  {hasSecondMajor && (
                    <th colSpan={3} className="border-r border-slate-200 py-1.5 bg-blue-50/50 text-blue-900">
                      {secondMajorHeaderLabel}
                    </th>
                  )}
                  <th rowSpan={2} className="border-r border-slate-200 px-3 py-2">법정교직</th>
                  <th rowSpan={2} className="border-r border-slate-200 px-3 py-2">
                    융합탐색<br />(타과포함)
                  </th>
                  <th rowSpan={3} className="px-4 py-2 font-bold text-slate-900">총계</th>
                </tr>
                <tr className="border-b border-slate-200 text-[11px]">
                  <th className="border-r border-slate-200 px-2 py-1">기초교양</th>
                  <th className="border-r border-slate-200 px-2 py-1">균형교양</th>
                  <th className="border-r border-slate-200 px-2 py-1 font-semibold">소계</th>
                  <th className="border-r border-slate-200 px-2 py-1">전공필수</th>
                  <th className="border-r border-slate-200 px-2 py-1">전공선택</th>
                  <th className="border-r border-slate-200 px-2 py-1 font-semibold">소계</th>
                  {hasSecondMajor && (
                    <>
                      <th className="border-r border-slate-200 px-2 py-1 bg-blue-50/30">전공필수</th>
                      <th className="border-r border-slate-200 px-2 py-1 bg-blue-50/30">전공선택</th>
                      <th className="border-r border-slate-200 px-2 py-1 font-semibold bg-blue-50/50">소계</th>
                    </>
                  )}
                </tr>
                <tr className="border-b border-slate-200 text-[10px] text-slate-500">
                  <th className="border-r border-slate-200 py-1">10학점</th>
                  <th className="border-r border-slate-200 py-1">{reqBalanceGeCredits}학점~</th>
                  <th className="border-r border-slate-200 py-1 font-semibold text-slate-700">{reqGeTotalCredits}학점</th>
                  <th className="border-r border-slate-200 py-1">21학점 (7과목)</th>
                  <th className="border-r border-slate-200 py-1">{hasSecondMajor ? '30학점~' : '51학점~'}</th>
                  <th className="border-r border-slate-200 py-1 font-bold">{hasSecondMajor ? '51학점~' : '72학점~'}</th>
                  {hasSecondMajor && (
                    <>
                      <th className="border-r border-slate-200 py-1 bg-blue-50/30">필수</th>
                      <th className="border-r border-slate-200 py-1 bg-blue-50/30">선택</th>
                      <th className="border-r border-slate-200 py-1 bg-blue-50/50 font-bold text-blue-900">
                        {reqSecondMajorCredits}학점~
                      </th>
                    </>
                  )}
                  <th className="border-r border-slate-200 py-1 font-bold">24학점</th>
                  <th className="border-r border-slate-200 py-1 font-semibold text-slate-700">
                    {isDoubleMajor ? '0 ~ 1학점' : '1 ~ 11학점'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {/* 1. 기이수 학점 */}
                <tr className="bg-white font-medium text-slate-700">
                  <td className="border-r border-slate-200 bg-slate-50 py-2 font-bold text-slate-800">
                    기이수 완료
                  </td>
                  <td className="border-r border-slate-200 py-1.5">{completedBasicGe.toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-1.5">{completedBalanceGe.toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-1.5 font-bold">{completedGeTotal.toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-1.5">{completedPrimaryBasic.toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-1.5">{completedPrimaryElective.toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-1.5 font-bold">{completedPrimaryCredits.toFixed(1)}</td>
                  {hasSecondMajor && (
                    <>
                      <td className="border-r border-slate-200 py-1.5 bg-blue-50/10">{completedSecondReq.toFixed(1)}</td>
                      <td className="border-r border-slate-200 py-1.5 bg-blue-50/10">{completedSecondEle.toFixed(1)}</td>
                      <td className="border-r border-slate-200 py-1.5 font-bold bg-blue-50/20">{completedSecondCredits.toFixed(1)}</td>
                    </>
                  )}
                  <td className="border-r border-slate-200 py-1.5">{completedTeachingCredits.toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-1.5">{completedGeneralEle.toFixed(1)}</td>
                  <td className="py-1.5 font-bold text-slate-900">{completedTotalCredits.toFixed(1)}</td>
                </tr>

                {/* 2. 현재 수강 중 학점 */}
                <tr className="bg-blue-50/30 font-medium text-blue-900">
                  <td className="border-r border-slate-200 bg-blue-50/60 py-2 font-bold text-blue-950">
                    현재 수강 중
                  </td>
                  <td className="border-r border-slate-200 py-1.5">0.0</td>
                  <td className="border-r border-slate-200 py-1.5">{enrolledGeCredits.toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-1.5 font-bold">{enrolledGeCredits.toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-1.5">{enrolledPrimaryBasic.toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-1.5">{enrolledPrimaryElective.toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-1.5 font-bold">{enrolledPrimaryCredits.toFixed(1)}</td>
                  {hasSecondMajor && (
                    <>
                      <td className="border-r border-slate-200 py-1.5">{enrolledSecondReq.toFixed(1)}</td>
                      <td className="border-r border-slate-200 py-1.5">{enrolledSecondEle.toFixed(1)}</td>
                      <td className="border-r border-slate-200 py-1.5 font-bold">{enrolledSecondCredits.toFixed(1)}</td>
                    </>
                  )}
                  <td className="border-r border-slate-200 py-1.5">{enrolledTeachingCredits.toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-1.5">{enrolledGeneralEle.toFixed(1)}</td>
                  <td className="py-1.5 font-bold text-blue-950">{enrolledTotalCredits.toFixed(1)}</td>
                </tr>

                {/* 3. 합산 예상 취득학점 */}
                <tr className="bg-slate-100/70 font-bold text-slate-900">
                  <td className="border-r border-slate-200 bg-slate-200/80 py-2.5 font-bold text-slate-900">
                    학기 완료 시 예상
                  </td>
                  <td className="border-r border-slate-200 py-2">{completedBasicGe.toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-2">{(completedBalanceGe + enrolledGeCredits).toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-2 text-emerald-700">
                    {(completedGeTotal + enrolledGeCredits).toFixed(1)}
                  </td>
                  <td className="border-r border-slate-200 py-2">{(completedPrimaryBasic + enrolledPrimaryBasic).toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-2">{(completedPrimaryElective + enrolledPrimaryElective).toFixed(1)}</td>
                  <td className="border-r border-slate-200 py-2 text-emerald-700">
                    {(completedPrimaryCredits + enrolledPrimaryCredits).toFixed(1)}
                  </td>
                  {hasSecondMajor && (
                    <>
                      <td className="border-r border-slate-200 py-2 bg-blue-100/40">
                        {(completedSecondReq + enrolledSecondReq).toFixed(1)}
                      </td>
                      <td className="border-r border-slate-200 py-2 bg-blue-100/40">
                        {(completedSecondEle + enrolledSecondEle).toFixed(1)}
                      </td>
                      <td className="border-r border-slate-200 py-2 text-blue-900 bg-blue-100/70 font-extrabold">
                        {(completedSecondCredits + enrolledSecondCredits).toFixed(1)}
                      </td>
                    </>
                  )}
                  <td className="border-r border-slate-200 py-2 text-emerald-700">
                    {(completedTeachingCredits + enrolledTeachingCredits).toFixed(1)}
                  </td>
                  <td className="border-r border-slate-200 py-2">
                    {(completedGeneralEle + enrolledGeneralEle).toFixed(1)}
                  </td>
                  <td className="py-2 text-indigo-900 font-extrabold">
                    {(completedTotalCredits + enrolledTotalCredits).toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 현재 수강 중인 과목 목록 (이수구분 인라인 변경) */}
        {enrolledCourses.length > 0 && (
          <div className="mt-8 rounded-lg border border-blue-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50/50 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-bold text-blue-950">
                  현재 학기 수강 중인 교과목 ({enrolledCourses.length}과목 · {enrolledTotalCredits.toFixed(1)}학점)
                </h2>
                <p className="text-xs text-blue-800">
                  이수구분 선택창을 눌러 즉시 변경할 수 있으며, 변경 사항은 데이터베이스에 실시간 저장됩니다.
                </p>
              </div>
              <button
                onClick={handleResetEnrolledCourses}
                className="text-xs font-semibold text-slate-500 hover:text-red-600 transition"
              >
                수강목록 비우기
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-2.5 px-4 font-semibold text-slate-700">이수구분 (변경 가능)</th>
                    <th className="py-2.5 px-4 font-semibold text-slate-700">과목코드</th>
                    <th className="py-2.5 px-4 font-semibold text-slate-700">교과목명</th>
                    <th className="py-2.5 px-4 font-semibold text-slate-700">학점</th>
                    <th className="py-2.5 px-4 font-semibold text-slate-700">담당교수</th>
                    <th className="py-2.5 px-4 font-semibold text-slate-700">강의실 / 시간</th>
                    <th className="py-2.5 px-4 text-right font-semibold text-slate-700">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrolledCourses.map((c) => (
                    <tr key={c.id} className="hover:bg-blue-50/30 transition">
                      <td className="py-2.5 px-4">
                        <select
                          value={c.category}
                          onChange={(e) => handleUpdateEnrolledCategory(c.id, e.target.value)}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-slate-800 shadow-sm"
                        >
                          {COURSE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">
                        {c.course_code || '-'}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {c.course_name}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 font-semibold">
                        {Number(c.credits).toFixed(1)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {c.professor || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {c.classroom || ''} {c.timetable ? `(${c.timetable.trim()})` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteEnrolledCourse(c.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          제외
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 수동 교과목 추가 폼 */}
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">MANUAL ENTRY</span>
            <h2 className="text-sm font-bold text-slate-900">기이수 교과목 개별 등록</h2>
          </div>

          <form onSubmit={handleAddCourse} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">과목코드 (선택)</label>
                <input
                  type="text"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="예: 0158008"
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700">교과목명</label>
                <input
                  type="text"
                  required
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="예: 자료구조"
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700">이수구분</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-800"
                >
                  {COURSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">학점</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={credits}
                  onChange={(e) => setCredits(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700">성적</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value as GradeType)}
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-800"
                >
                  {GRADE_TYPES.map((g) => (
                    <option key={g} value={g}>{g} ({GRADE_POINTS_MAP[g]}점)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700">이수년도</label>
                <input
                  type="number"
                  required
                  value={takenYear}
                  onChange={(e) => setTakenYear(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700">이수학기</label>
                <select
                  value={takenSemester}
                  onChange={(e) => setTakenSemester(e.target.value as SemesterType)}
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-800"
                >
                  <option value="1학기">1학기</option>
                  <option value="2학기">2학기</option>
                  <option value="하계학기">하계학기</option>
                  <option value="동계학기">동계학기</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="rounded bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                교과목 등록
              </button>
            </div>
          </form>
        </div>

        {/* 교원자격 무시험검정 비교과 관리 섹션 */}
        {nonSubject && (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">NON-SUBJECT RECORD</span>
              <h2 className="text-sm font-bold text-slate-900">교원자격 무시험검정 비교과 요건 관리</h2>
              <p className="mt-1 text-xs text-slate-500">
                교직인적성(2회), 응급처치(2회), 성인지 교육(4회), 교육봉사(60시간), 마약류 중독 검사 및 한국사 요건을 기록합니다.
              </p>
            </div>

            <form onSubmit={handleUpdateNonSubject} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">성인지 교육 횟수 (기준: 4회)</label>
                  <input
                    type="number"
                    min="0"
                    value={nonSubject.gender_equity_education_count}
                    onChange={(e) =>
                      setNonSubject({
                        ...nonSubject,
                        gender_equity_education_count: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">교직인적성 검사 (기준: 2회)</label>
                  <input
                    type="number"
                    min="0"
                    value={nonSubject.teaching_aptitude_test_count}
                    onChange={(e) =>
                      setNonSubject({
                        ...nonSubject,
                        teaching_aptitude_test_count: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">응급처치 실습 (기준: 2회)</label>
                  <input
                    type="number"
                    min="0"
                    value={nonSubject.cpr_training_count}
                    onChange={(e) =>
                      setNonSubject({
                        ...nonSubject,
                        cpr_training_count: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">교육봉사활동 시간 (기준: 60시간)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={nonSubject.volunteer_hours}
                    onChange={(e) =>
                      setNonSubject({
                        ...nonSubject,
                        volunteer_hours: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nonSubject.narcotics_test_submitted}
                    onChange={(e) =>
                      setNonSubject({
                        ...nonSubject,
                        narcotics_test_submitted: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300"
                  />
                  <span>마약류 중독 검사 결과 제출 완료</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nonSubject.korean_history_certified}
                    onChange={(e) =>
                      setNonSubject({
                        ...nonSubject,
                        korean_history_certified: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300"
                  />
                  <span>한국사능력검정시험 (3급 이상) 인증 완료</span>
                </label>

                <button
                  type="submit"
                  className="ml-auto rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  비교과 변경사항 저장
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 기이수 교과목 데이터 테이블 (이수구분 인라인 변경) */}
        <div className="mt-8 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">등록된 기이수 교과목 목록</h2>
              <p className="text-xs text-slate-500">
                총 {courses.length}개 교과목 (이수구분 드롭다운을 통해 바로 변경하고 실시간 저장할 수 있습니다)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-2.5 px-4 font-semibold text-slate-700">이수학기</th>
                  <th className="py-2.5 px-4 font-semibold text-slate-700">과목코드</th>
                  <th className="py-2.5 px-4 font-semibold text-slate-700">교과목명</th>
                  <th className="py-2.5 px-4 font-semibold text-slate-700">이수구분 (변경 가능)</th>
                  <th className="py-2.5 px-4 font-semibold text-slate-700">학점</th>
                  <th className="py-2.5 px-4 font-semibold text-slate-700">성적</th>
                  <th className="py-2.5 px-4 font-semibold text-slate-700">평점</th>
                  <th className="py-2.5 px-4 text-right font-semibold text-slate-700">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      성적 데이터를 불러오는 중...
                    </td>
                  </tr>
                ) : courses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      등록된 기이수 과목이 없습니다. 포털 엑셀을 업로드하거나 개별 등록하십시오.
                    </td>
                  </tr>
                ) : (
                  courses.map((course) => (
                    <tr key={course.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-4 text-slate-600">
                        {course.taken_year}년도 {course.taken_semester}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">
                        {(course as any).course_code || '-'}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {course.course_name}
                      </td>
                      <td className="py-2.5 px-4">
                        <select
                          value={course.category}
                          onChange={(e) => handleUpdateCompletedCategory(course.id, e.target.value)}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-slate-800 shadow-sm"
                        >
                          {COURSE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{Number(course.credits).toFixed(1)}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{course.grade}</td>
                      <td className="py-2.5 px-4 text-slate-600">{Number(course.grade_point).toFixed(1)}</td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteCourse(course.id)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 기이수 누적성적 엑셀 모달 */}
        {userId && (
          <ExcelUploadModal
            userId={userId}
            isOpen={isExcelModalOpen}
            onClose={() => setIsExcelModalOpen(false)}
            onSuccess={() => loadData()}
          />
        )}

        {/* 현재 수강과목 엑셀 모달 */}
        {userId && (
          <EnrolledUploadModal
            userId={userId}
            isOpen={isEnrolledModalOpen}
            onClose={() => setIsEnrolledModalOpen(false)}
            onSuccess={() => loadData()}
          />
        )}

        {/* 공용 개설강좌 엑셀 모달 */}
        <OfferedUploadModal
          isOpen={isOfferedModalOpen}
          onClose={() => setIsOfferedModalOpen(false)}
          onSuccess={() => loadData()}
        />
      </div>

    
    </div>
  );
}