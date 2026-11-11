'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MajorTrack, getCollegeOfEducationRequirements } from '@/types/curriculum';

interface UserProfile {
  id: string;
  name?: string;
  full_name?: string;
  student_number?: string;
  student_id?: string;
  primary_major?: string;
  track?: 'SINGLE_MAJOR' | 'DOUBLE_MAJOR' | 'MINOR';
  major_track?: MajorTrack;
  double_major?: string | null;
  minor_major?: string | null;
  secondary_major?: string | null;
  admission_year?: number;
}

interface CompletedCourse {
  id: string;
  course_code: string | null;
  course_name: string;
  category: string;
  credits: number;
  grade: string;
  grade_point: number;
  taken_year: number;
  taken_semester: string;
  is_major_course: boolean;
  is_teaching_course: boolean;
}

interface EnrolledCourse {
  id: string;
  course_code: string | null;
  course_name: string;
  category: string;
  credits: number;
  professor: string | null;
}

interface UnifiedCourseItem {
  id: string;
  course_code: string | null;
  course_name: string;
  category: string;
  credits: number;
  grade: string;
  grade_point: number;
  taken_year: number;
  taken_semester: string;
  is_major_course: boolean;
  is_teaching_course: boolean;
  isEnrolled: boolean;
}

interface NonSubjectRecord {
  gender_equity_education_count: number;
  teaching_aptitude_test_count: number;
  cpr_training_count: number;
  volunteer_hours: number;
  narcotics_test_submitted: boolean;
  korean_history_certified: boolean;
}

// 자연·공학·사범 이과 학과 목록
const NATURAL_SCIENCE_MAJORS = [
  '컴퓨터교육과',
  '수학교육과',
  '물리교육과',
  '화학교육과',
  '생물교육과',
  '지구과학교육과',
  '기술·가정교육과',
];

// 컴퓨터교육과 지정 전공필수 7과목 규격
const COMP_MANDATORY_COURSES = [
  { name: '프로그래밍', keywords: ['프로그래밍I', '프로그래밍', '프로그래밍1', '프로그래밍기초'] },
  { name: '자료구조', keywords: ['자료구조'] },
  { name: '컴퓨터구조', keywords: ['컴퓨터구조'] },
  { name: '알고리즘', keywords: ['알고리즘'] },
  { name: '정보윤리교육개론', keywords: ['정보윤리교육개론', '정보윤리교육'] },
  { name: '운영체제', keywords: ['운영체제'] },
  { name: '정보교과교육론', keywords: ['정보교과교육론', '컴퓨터교과교육론'] },
];

export default function AuditPage() {
  const supabase = createClient();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);
  const [nonSubject, setNonSubject] = useState<NonSubjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAuditData() {
      setIsLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const [profileRes, completedRes, enrolledRes, nonSubjectRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('profiles') as any).select('*').eq('id', user.id).maybeSingle(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('user_completed_courses') as any).select('*').eq('user_id', user.id),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('user_enrolled_courses') as any).select('*').eq('user_id', user.id),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('user_non_subject_records') as any).select('*').eq('user_id', user.id).maybeSingle(),
        ]);

        let loadedProfile = profileRes.data as UserProfile | null;
        if (!loadedProfile && user.user_metadata) {
          loadedProfile = {
            id: user.id,
            name: user.user_metadata.full_name || '',
            student_number: user.user_metadata.student_id || '',
            primary_major: user.user_metadata.primary_major || '컴퓨터교육과',
            major_track: (user.user_metadata.major_track as MajorTrack) || 'SINGLE',
            secondary_major: user.user_metadata.secondary_major || null,
            admission_year: user.user_metadata.admission_year || 2025,
          };
        }

        if (loadedProfile) setProfile(loadedProfile);
        if (completedRes.data) setCompletedCourses(completedRes.data as CompletedCourse[]);
        if (enrolledRes.data) setEnrolledCourses(enrolledRes.data as EnrolledCourse[]);
        if (nonSubjectRes.data) setNonSubject(nonSubjectRes.data as NonSubjectRecord);
      } catch (err) {
        console.error('사정 데이터 로드 실패:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadAuditData();
  }, [supabase]);

  const auditResult = useMemo(() => {
    // 트랙 및 전공명 정규화
    const primaryMajor = profile?.primary_major || '컴퓨터교육과';
    const secondaryMajor = profile?.secondary_major || profile?.double_major || profile?.minor_major || null;

    let normalizedTrack: MajorTrack = 'SINGLE';
    if (profile?.major_track) {
      normalizedTrack = profile.major_track;
    } else if (profile?.track === 'DOUBLE_MAJOR' || profile?.double_major) {
      normalizedTrack = 'DOUBLE';
    } else if (profile?.track === 'MINOR' || profile?.minor_major) {
      normalizedTrack = 'MINOR';
    }

    const isDouble = normalizedTrack === 'DOUBLE';
    const isMinor = normalizedTrack === 'MINOR';
    const isSingle = normalizedTrack === 'SINGLE';

    const trackReq = getCollegeOfEducationRequirements({
      primaryMajorName: primaryMajor,
      track: normalizedTrack,
      secondaryMajorName: secondaryMajor || '',
    });

    const isNaturalScience = NATURAL_SCIENCE_MAJORS.includes(primaryMajor);
    const requiredSwCourseName = isNaturalScience ? '컴퓨팅적사고' : 'SW와문제해결';

    // 통합 과목 배열 구성 (F, NP 제외)
    const validCompleted = completedCourses.filter(
      (c) => c.grade !== 'F' && c.grade !== 'NP' && c.grade !== 'FA'
    );

    const allCourses: UnifiedCourseItem[] = [
      ...validCompleted.map((c) => ({
        id: c.id,
        course_code: c.course_code,
        course_name: c.course_name,
        category: c.category || '',
        credits: Number(c.credits || 0),
        grade: c.grade,
        grade_point: Number(c.grade_point || 0),
        taken_year: c.taken_year,
        taken_semester: c.taken_semester,
        is_major_course: Boolean(c.is_major_course),
        is_teaching_course: Boolean(c.is_teaching_course),
        isEnrolled: false,
      })),
      ...enrolledCourses.map((c) => {
        const cat = c.category || '';
        const name = c.course_name || '';
        const isMajor =
          cat.includes('전공') ||
          cat.includes('전선') ||
          cat.includes('전필') ||
          cat.includes('복수') ||
          cat.includes('부전');
        const isTeaching =
          cat.includes('교직') ||
          cat.includes('일반교육학') ||
          cat.includes('교실') ||
          cat.includes('일교');

        return {
          id: c.id,
          course_code: c.course_code,
          course_name: name,
          category: cat,
          credits: Number(c.credits || 0),
          grade: '수강중',
          grade_point: 0,
          taken_year: 2026,
          taken_semester: '현재',
          is_major_course: isMajor,
          is_teaching_course: isTeaching,
          isEnrolled: true,
        };
      }),
    ];

    // 1. 기초교양 필수 10학점 매핑
    const geEnglishLR = allCourses.find((c) => c.course_name.includes('Communication') && (c.course_name.includes('L') || c.course_name.includes('R')));
    const geEnglishSW = allCourses.find((c) => c.course_name.includes('Communication') && (c.course_name.includes('S') || c.course_name.includes('W')));
    const geThinking = allCourses.find((c) => c.course_name.includes('비판적사고와소통') || c.course_name.includes('사고와소통'));
    const geSw = allCourses.find((c) => c.course_name.includes(requiredSwCourseName));
    const geCareer = allCourses.find((c) => c.course_name.includes('대학생활과미래설계'));

    const basicGeList = [
      { name: 'Communication in English(L&R) I', credits: 2, matched: geEnglishLR },
      { name: 'Communication in English(S&W) I', credits: 2, matched: geEnglishSW },
      { name: '비판적사고와소통', credits: 3, matched: geThinking },
      { name: `${requiredSwCourseName} (${isNaturalScience ? '이과 지정' : '문과 지정'})`, credits: 2, matched: geSw },
      { name: '대학생활과미래설계', credits: 1, matched: geCareer },
    ];
    const basicGeEarned = basicGeList.filter((b) => b.matched && !b.matched.isEnrolled).reduce((sum, b) => sum + b.credits, 0);
    const basicGeExpected = basicGeList.filter((b) => b.matched).reduce((sum, b) => sum + b.credits, 0);

    // 2. 균형교양 및 총 교양학점 판정 (단일/부: 3개 영역 포함 12학점 / 복수: 8학점)
    const geCourses = allCourses.filter((c) => c.category.includes('교양') || c.category.includes('균형') || c.category.includes('기초'));
    const totalGeEarned = geCourses.filter((c) => !c.isEnrolled).reduce((sum, c) => sum + c.credits, 0);
    const totalGeExpected = geCourses.reduce((sum, c) => sum + c.credits, 0);
    const requiredGeTotal = isDouble ? 18.0 : 36.0;

    const balanceGeCourses = allCourses.filter((c) => c.category.includes('균형') || c.category.includes('균선') || (c as any).subCategory?.includes('균형'));
    const balanceGeEarned = balanceGeCourses.filter((c) => !c.isEnrolled).reduce((sum, c) => sum + c.credits, 0);
    const balanceGeExpected = balanceGeCourses.reduce((sum, c) => sum + c.credits, 0);
    const balanceGeReq = isDouble ? 8.0 : 12.0;

    // 3. 컴퓨터교육과 전공필수 7과목
    const compMandatoryResults = COMP_MANDATORY_COURSES.map((target) => {
      const match = allCourses.find((c) =>
        !c.category.includes('복수') &&
        !c.category.includes('부전') &&
        target.keywords.some((k) => c.course_name.includes(k))
      );
      return {
        name: target.name,
        matchedCourse: match ? match.course_name : null,
        credits: match ? match.credits : 3.0,
        isEnrolled: match?.isEnrolled || false,
        fulfilled: Boolean(match),
      };
    });
    const compMandatoryFulfilledCount = compMandatoryResults.filter((m) => m.fulfilled).length;

    // 4. 졸업 필수 요건: 캡스톤디자인Ⅱ
    const capstoneCourse = allCourses.find((c) =>
      !c.category.includes('복수') &&
      !c.category.includes('부전') &&
      (c.course_name.includes('캡스톤디자인Ⅱ') || c.course_name.includes('캡스톤디자인2') || c.course_name.includes('캡스톤디자인 Ⅱ'))
    );

    // 5. 전공선택 학점 집계 (콜라주 제외, 순수 전공선택 합산: 단일 51학점 / 복수 30학점)
    const requiredMajorElectiveCredits = isSingle ? 51.0 : 30.0;
    const majorElectiveCourses = allCourses.filter((c) => {
      const isMajor = c.category.includes('전선') || c.category.includes('전공선택') || c.category.includes('전공핵심') || c.category.includes('전공심화');
      const isReq = COMP_MANDATORY_COURSES.some((t) => t.keywords.some((k) => c.course_name.includes(k)));
      return isMajor && !isReq && !c.category.includes('복수') && !c.category.includes('부전');
    });
    const majorElectiveEarned = majorElectiveCourses.filter((c) => !c.isEnrolled).reduce((sum, c) => sum + c.credits, 0);
    const majorElectiveExpected = majorElectiveCourses.reduce((sum, c) => sum + c.credits, 0);

    // 6. 교과교육학 (전공 8학점 영역: 정보교과교육론, 정보교과교재연구, 정보논리논술개론)
    const subjectEduCourses = allCourses.filter((c) =>
      !c.category.includes('복수') &&
      !c.category.includes('부전') &&
      !c.course_name.includes('정보윤리교육') &&
      (c.course_name.includes('정보교과교육론') ||
        c.course_name.includes('교재연구') ||
        c.course_name.includes('논술'))
    );
    const subjectEduCredits = subjectEduCourses.reduce((sum, c) => sum + c.credits, 0);

    // 7. 법정 교직과목 24.0학점 (이론 12 + 소양 8 + 실습 4)
    const pureTeachingCourses = allCourses.filter((c) => {
      const isEduTheory =
        c.course_name.includes('교재연구') ||
        c.course_name.includes('정보윤리교육') ||
        c.course_name.includes('논술');
      if (isEduTheory) return false;

      return (
        c.is_teaching_course ||
        ['교직', '일반교육학', '교직과목', '교실', '일교'].some((k) => c.category.includes(k)) ||
        [
          '교육평가', '교육학개론', '교육사회', '교육행정및교육경영', '디지털교육',
          '생활지도와상담', '교육봉사Ⅰ', '교육봉사 I', '교육봉사Ⅱ', '교육봉사 II',
          '특수교육학개론', '교육방법및교육공학', '교육과정', '교직실무', '학교현장실습'
        ].some((k) => c.course_name.includes(k))
      );
    });
    const pureTeachingEarned = pureTeachingCourses.filter((c) => !c.isEnrolled).reduce((sum, c) => sum + c.credits, 0);
    const pureTeachingExpected = pureTeachingCourses.reduce((sum, c) => sum + c.credits, 0);

    // 8. 제2전공(복수전공 50학점 / 부전공 21학점)
    const requiredSecondaryCredits = isDouble ? 50.0 : isMinor ? 21.0 : 0.0;
    const secondaryCourses = allCourses.filter((c) => {
      if (isDouble) return c.category.includes('복수') || c.category.includes('복필') || c.category.includes('복선');
      if (isMinor) return c.category.includes('부전') || c.category.includes('부필') || c.category.includes('부선');
      return false;
    });
    const secondaryEarned = secondaryCourses.filter((c) => !c.isEnrolled).reduce((sum, c) => sum + c.credits, 0);
    const secondaryExpected = secondaryCourses.reduce((sum, c) => sum + c.credits, 0);

    // 9. 주전공(컴퓨터교육과) 이수 현황 (단일 72학점 / 복수 50학점)
    const primaryRequiredTotal = isSingle ? 72.0 : 50.0;
    const primaryCourses = allCourses.filter((c) =>
      !c.category.includes('복수') &&
      !c.category.includes('부전') &&
      (c.is_major_course || ['전공', '전기', '전필', '전선', '전핵', '전심'].some((k) => c.category.includes(k)))
    );
    const primaryEarned = primaryCourses.filter((c) => !c.isEnrolled).reduce((sum, c) => sum + c.credits, 0);
    const primaryExpected = primaryCourses.reduce((sum, c) => sum + c.credits, 0);

    // 10. 총 졸업 학점 판정 (단일 140 / 복수 144)
    const targetGrad = isDouble ? 144.0 : 140.0;
    const totalEarned = validCompleted.reduce((sum, c) => sum + Number(c.credits || 0), 0);
    const totalEnrolled = enrolledCourses.reduce((sum, c) => sum + Number(c.credits || 0), 0);

    return {
      normalizedTrack,
      isDouble,
      isMinor,
      isSingle,
      primaryMajor,
      secondaryMajor,
      trackReq,
      isNaturalScience,
      requiredSwCourseName,
      targetGrad,
      totalEarned,
      totalEnrolled,
      totalExpected: totalEarned + totalEnrolled,
      basicGeList,
      basicGeEarned,
      basicGeExpected,
      totalGeEarned,
      totalGeExpected,
      requiredGeTotal,
      balanceGeReq,
      balanceGeEarned,
      balanceGeExpected,
      compMandatoryResults,
      compMandatoryFulfilledCount,
      capstoneCourse,
      requiredMajorElectiveCredits,
      majorElectiveEarned,
      majorElectiveExpected,
      subjectEduCourses,
      subjectEduCredits,
      pureTeachingCourses,
      pureTeachingEarned,
      pureTeachingExpected,
      primaryRequiredTotal,
      primaryCourses,
      primaryEarned,
      primaryExpected,
      requiredSecondaryCredits,
      secondaryCourses,
      secondaryEarned,
      secondaryExpected,
    };
  }, [profile, completedCourses, enrolledCourses]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center text-xs text-slate-400 sm:px-6">
        학사 사정 데이터를 엄밀히 대조 분석하고 있습니다...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 flex-1 w-full">
        {/* 상단 공문형 타이틀 */}
        <div className="border-b border-slate-200 pb-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            OFFICIAL ACADEMIC AUDIT REPORT
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            교원자격 무시험검정 및 졸업 사정 진단
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {profile?.full_name || profile?.name || '사용자'} ({profile?.student_id || profile?.student_number || '학번'}) | 주전공: {auditResult.primaryMajor}
            {auditResult.normalizedTrack === 'DOUBLE' && ` · 복수전공: ${auditResult.secondaryMajor || '제2전공'} (사범대 복수전공 144학점 체계)`}
            {auditResult.normalizedTrack === 'MINOR' && ` · 부전공: ${auditResult.secondaryMajor || '제2전공'} (사범대 부전공 140학점 체계)`}
            {auditResult.normalizedTrack === 'SINGLE' && ' · 단일전공 (전공 72학점 이상 이수 및 총 140학점 체계)'}
          </p>
        </div>

        {/* 종합 진척 요약 카드 */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase text-slate-400">총 취득학점</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900">{auditResult.totalEarned.toFixed(1)}</span>
              <span className="text-xs font-semibold text-blue-600">+{auditResult.totalEnrolled.toFixed(1)}</span>
              <span className="text-xs text-slate-400">/ {auditResult.targetGrad}학점</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              학기 완료 시 예상: <strong>{auditResult.totalExpected.toFixed(1)}</strong>학점
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase text-slate-400">
              {auditResult.isSingle ? '주전공 (필수21+선택51)' : '주전공 이수'}
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900">
                {auditResult.primaryExpected.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">/ {auditResult.primaryRequiredTotal}학점</span>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-emerald-600">
              {auditResult.primaryExpected >= auditResult.primaryRequiredTotal
                ? '주전공 기준 충족'
                : `기준 미달 (${(auditResult.primaryRequiredTotal - auditResult.primaryExpected).toFixed(1)}학점 부족)`}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase text-slate-400">법정 교직 (이론12+소양8+실습4)</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900">{auditResult.pureTeachingEarned.toFixed(1)}</span>
              <span className="text-xs font-semibold text-blue-600">
                {auditResult.pureTeachingExpected > auditResult.pureTeachingEarned
                  ? `+${(auditResult.pureTeachingExpected - auditResult.pureTeachingEarned).toFixed(1)}`
                  : ''}
              </span>
              <span className="text-xs text-slate-400">/ 24.0학점</span>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-emerald-600">
              {auditResult.pureTeachingExpected >= 24.0
                ? '법정 교직 24학점 완비 (100%)'
                : `교직 이수 필요 (${(24.0 - auditResult.pureTeachingExpected).toFixed(1)}학점 부족)`}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase text-slate-400">졸업요건 캡스톤</span>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {auditResult.capstoneCourse ? '캡스톤디자인Ⅱ 완료' : '캡스톤디자인Ⅱ 미이수'}
            </p>
            <p className={`mt-1 text-[11px] font-semibold ${auditResult.capstoneCourse ? 'text-emerald-600' : 'text-amber-600'}`}>
              {auditResult.capstoneCourse ? '학과 졸업요건 충족' : '졸업 필수 교과목 (3-2 이수)'}
            </p>
          </div>
        </div>

        {/* 1. 컴퓨터교육과 전공필수 7과목 및 캡스톤Ⅱ */}
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                1. 컴퓨터교육과 전공필수 7과목 (21학점) 및 캡스톤디자인Ⅱ
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                전공필수 7과목은 예외 없이 전원 이수해야 하며, 캡스톤디자인Ⅱ는 학과 졸업 필수 요건입니다.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-700">
              필수 충족: {auditResult.compMandatoryFulfilledCount} / 7과목
            </span>
          </div>

          {/* 전공필수 7과목 그리드 */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-7">
            {auditResult.compMandatoryResults.map((item, idx) => (
              <div
                key={idx}
                className={`rounded-lg border p-3 text-xs ${
                  item.fulfilled
                    ? item.isEnrolled
                      ? 'border-blue-200 bg-blue-50/50'
                      : 'border-emerald-200 bg-emerald-50/50'
                    : 'border-red-200 bg-red-50/50'
                }`}
              >
                <span className="text-[10px] font-bold uppercase text-slate-400">전필 {idx + 1}</span>
                <p className="mt-0.5 font-bold text-slate-900">{item.name}</p>
                <div className="mt-2 text-[11px]">
                  {item.matchedCourse ? (
                    <div>
                      <span className={`font-semibold ${item.isEnrolled ? 'text-blue-700' : 'text-emerald-700'}`}>
                        {item.matchedCourse}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {item.isEnrolled ? '수강 중 (+3학점)' : '기이수 완료'}
                      </p>
                    </div>
                  ) : (
                    <span className="font-semibold text-red-600">미이수</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 캡스톤디자인Ⅱ 상태 바 */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-800">학과 전공 졸업 필수요건: 캡스톤디자인Ⅱ</span>
              <p className="text-[11px] text-slate-500 mt-0.5">졸업논문 대체 교과목으로 3학년 2학기 이수 대상입니다.</p>
            </div>
            <div>
              {auditResult.capstoneCourse ? (
                <span className="rounded bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  이수 완료
                </span>
              ) : (
                <span className="rounded bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                  수강 예정 (3학년 2학기)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. 전공선택(최소+심화) & 정보 교과교육학 (8학점) */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 전공선택 학점 판정 (단일 51 / 복수 30) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="border-b border-slate-100 pb-2.5 mb-3 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  2. 전공선택 이수 요건 (최소전공 + 심화과정)
                </h2>
                <p className="text-xs text-slate-500">
                  {auditResult.isSingle ? '단일전공 심화 기준: 전공선택 51학점 이상 이수' : '복수/부전공 기준: 전공선택 30학점 이상 이수'}
                </p>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {auditResult.majorElectiveExpected.toFixed(1)} / {auditResult.requiredMajorElectiveCredits}학점
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">전공선택 최저 기준:</span>
                <span className="font-bold text-slate-900">{auditResult.requiredMajorElectiveCredits}학점</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">취득 및 수강 중 학점:</span>
                <span className={`font-bold ${auditResult.majorElectiveExpected >= auditResult.requiredMajorElectiveCredits ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {auditResult.majorElectiveExpected.toFixed(1)}학점 ({auditResult.majorElectiveExpected >= auditResult.requiredMajorElectiveCredits ? '충족' : '부족'})
                </span>
              </div>
            </div>
          </div>

          {/* 교과교육학 (8학점) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="border-b border-slate-100 pb-2.5 mb-3 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-slate-900">3. 정보 교과교육학 (전공 산입 영역)</h2>
                <p className="text-xs text-slate-500">교직이 아닌 전공 학점으로 인정되는 교과교육영역(최소 8학점)입니다.</p>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {auditResult.subjectEduCredits.toFixed(1)} / 8.0학점
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">교과교육학 최저 이수 기준:</span>
                <span className="font-bold text-slate-900">8학점 이상 필수 (정보교과교육론, 교재연구, 논술)</span>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold text-slate-700 mb-2">인정된 교과교육학 과목:</p>
              <div className="flex flex-wrap gap-1.5">
                {auditResult.subjectEduCourses.length === 0 ? (
                  <span className="text-slate-400 text-xs">등록된 과목이 없습니다.</span>
                ) : (
                  auditResult.subjectEduCourses.map((c, i) => (
                    <span
                      key={i}
                      className={`rounded px-2.5 py-1 text-xs font-medium ${
                        c.isEnrolled ? 'bg-blue-100 text-blue-900 border border-blue-200' : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {c.course_name} ({c.credits}학점) {c.isEnrolled ? '- 수강중' : ''}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. 법정 교직 24학점 & 교양 영역 진단 */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 법정 교직 24학점 */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="border-b border-slate-100 pb-2.5 mb-3 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-slate-900">4. 순수 법정 교직과목 (24.0학점 완비 요건)</h2>
                <p className="text-xs text-slate-500">교직이론(12) + 교직소양(8) + 교육봉사/실습(4) 법정 요건입니다.</p>
              </div>
              <span className={`text-xs font-bold ${auditResult.pureTeachingExpected >= 24.0 ? 'text-emerald-700' : 'text-slate-800'}`}>
                {auditResult.pureTeachingExpected.toFixed(1)} / 24.0학점
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">법정 교직 총 이수 상태:</span>
                <span className={`font-bold ${auditResult.pureTeachingExpected >= 24.0 ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {auditResult.pureTeachingExpected >= 24.0
                    ? '24.0학점 전원 완비'
                    : `${(24.0 - auditResult.pureTeachingExpected).toFixed(1)}학점 추가 이수 필요`}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold text-slate-700 mb-2">순수 교직과목 이수 및 수강 목록:</p>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {auditResult.pureTeachingCourses.map((c, i) => (
                  <span
                    key={i}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                      c.isEnrolled ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {c.course_name} ({c.credits}학점)
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 교양 이수 요건 진단 (단일 36 / 복수 18) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="border-b border-slate-100 pb-2.5 mb-3 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  5. 교양 영역 이수 진단 ({auditResult.requiredGeTotal}학점 기준)
                </h2>
                <p className="text-xs text-slate-500">
                  {auditResult.isDouble
                    ? '복수전공 교양 감면: 기초(10) + 균형선택 8학점 포함 총 18학점'
                    : '단일/부전공: 기초(10) + 균형선택 12학점(3개 영역 이상) 포함 총 36학점'}
                </p>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {auditResult.totalGeExpected.toFixed(1)} / {auditResult.requiredGeTotal}학점
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">교양 총 취득학점:</span>
                <span className={`font-bold ${auditResult.totalGeExpected >= auditResult.requiredGeTotal ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {auditResult.totalGeExpected.toFixed(1)} / {auditResult.requiredGeTotal}학점
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">
                  균형교양 선택 (요구: {auditResult.balanceGeReq}학점):
                </span>
                <span className={`font-bold ${auditResult.balanceGeExpected >= auditResult.balanceGeReq ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {auditResult.balanceGeExpected.toFixed(1)} / {auditResult.balanceGeReq}학점 ({auditResult.balanceGeExpected >= auditResult.balanceGeReq ? '충족' : '부족'})
                </span>
              </div>
            </div>

            {auditResult.normalizedTrack !== 'SINGLE' && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-[11px] font-semibold text-slate-700 mb-1">
                  제2전공 ({auditResult.secondaryMajor || '복수/부전공'}):
                </p>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-slate-600">요구 이수 학점:</span>
                  <span className="font-bold text-slate-900">{auditResult.requiredSecondaryCredits}학점</span>
                </div>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-slate-600">현재 이수 총점:</span>
                  <span className="font-bold text-slate-900">{auditResult.secondaryExpected.toFixed(1)}학점</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. 교원자격 무시험검정 법정 비교과 요건 */}
        {nonSubject && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5 mb-3">
              6. 교원자격 무시험검정 법정 비교과 요건 검증
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 text-center text-xs">
              <div className={`rounded-lg border p-3 ${nonSubject.gender_equity_education_count >= 4 ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                <span className="text-[10px] text-slate-500">성인지 교육</span>
                <p className="mt-1 font-bold text-slate-900">{nonSubject.gender_equity_education_count} / 4회</p>
                <span className="text-[10px] text-slate-500">{nonSubject.gender_equity_education_count >= 4 ? '충족' : '부족'}</span>
              </div>
              <div className={`rounded-lg border p-3 ${nonSubject.teaching_aptitude_test_count >= 2 ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                <span className="text-[10px] text-slate-500">교직인적성</span>
                <p className="mt-1 font-bold text-slate-900">{nonSubject.teaching_aptitude_test_count} / 2회</p>
                <span className="text-[10px] text-slate-500">{nonSubject.teaching_aptitude_test_count >= 2 ? '충족' : '부족'}</span>
              </div>
              <div className={`rounded-lg border p-3 ${nonSubject.cpr_training_count >= 2 ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                <span className="text-[10px] text-slate-500">응급처치 실습</span>
                <p className="mt-1 font-bold text-slate-900">{nonSubject.cpr_training_count} / 2회</p>
                <span className="text-[10px] text-slate-500">{nonSubject.cpr_training_count >= 2 ? '충족' : '부족'}</span>
              </div>
              <div className={`rounded-lg border p-3 ${nonSubject.volunteer_hours >= 60 ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                <span className="text-[10px] text-slate-500">교육봉사활동</span>
                <p className="mt-1 font-bold text-slate-900">{nonSubject.volunteer_hours} / 60시간</p>
                <span className="text-[10px] text-slate-500">{nonSubject.volunteer_hours >= 60 ? '충족' : '부족'}</span>
              </div>
              <div className={`rounded-lg border p-3 ${nonSubject.narcotics_test_submitted ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'}`}>
                <span className="text-[10px] text-slate-500">마약류 검사</span>
                <p className="mt-1 font-bold text-slate-900">{nonSubject.narcotics_test_submitted ? '제출 완료' : '미제출'}</p>
              </div>
              <div className={`rounded-lg border p-3 ${nonSubject.korean_history_certified ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'}`}>
                <span className="text-[10px] text-slate-500">한국사 검정</span>
                <p className="mt-1 font-bold text-slate-900">{nonSubject.korean_history_certified ? '3급 이상 완료' : '미제출'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

  
    </div>
  );
}