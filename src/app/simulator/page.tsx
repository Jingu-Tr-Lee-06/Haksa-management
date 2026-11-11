// src/app/simulator/page.tsx
'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  SemesterPlanState,
  PlannedCourseItem,
  recalculateAllPlans,
  validateAddCourseToPlan,
  KNU_COLLEGE_OF_EDUCATION_RULE,
} from '@/lib/simulator/engine';
import { CourseCategory, SemesterType } from '@/types/database.types';
import OfferedUploadModal from '@/components/curriculum/OfferedUploadModal';

interface OfferedCourseItem {
  id: string;
  course_code: string;
  course_name: string;
  class_section: string;
  credits: number;
  category: string;
  professor_name: string;
  timetable: string | null;
  classroom: string | null;
}

interface UserProfile {
  id: string;
  name: string;
  student_number: string;
  primary_major: string;
  track: 'SINGLE_MAJOR' | 'DOUBLE_MAJOR' | 'MINOR';
  double_major: string | null;
  minor_major: string | null;
  admission_year: number;
}

const BASE_CATEGORY_OPTIONS: CourseCategory[] = [
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

export default function SimulatorPage() {
  const supabase = createClient();
  const [, startTransition] = useTransition();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plans, setPlans] = useState<SemesterPlanState[]>([]);
  const [highGpaFlags, setHighGpaFlags] = useState<Record<string, boolean>>({});
  const [completedCredits, setCompletedCredits] = useState<number>(0.0);
  const [enrolledCurrentCredits, setEnrolledCurrentCredits] = useState<number>(0.0);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfferedModalOpen, setIsOfferedModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 학기 추가 상태
  const [newYear, setNewYear] = useState<number>(2026);
  const [newSemester, setNewSemester] = useState<SemesterType>('1학기');

  // 개설강좌 모달 상태
  const [activePlanKey, setActivePlanKey] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [offeredList, setOfferedList] = useState<OfferedCourseItem[]>([]);
  const [isSearchingOffered, setIsSearchingOffered] = useState(false);

  // 개별 과목 직접 등록 상태
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState<CourseCategory>('전공핵심');
  const [manualCredits, setManualCredits] = useState<number>(3.0);

  // 트랙별 동적 판정 (단일/부: 140학점, 복수: 144학점)
  const isDoubleMajor = profile?.track === 'DOUBLE_MAJOR' || Boolean(profile?.double_major);
  const isMinor = profile?.track === 'MINOR' || Boolean(profile?.minor_major);
  const targetGradCredits = isDoubleMajor ? 144.0 : 140.0;

  // 동적 카테고리 옵션 구성 (제2전공 트랙 반영)
  const categoryOptions = React.useMemo(() => {
    const list = [...BASE_CATEGORY_OPTIONS];
    if (isDoubleMajor) {
      list.splice(3, 0, '복수전공' as CourseCategory);
    } else if (isMinor) {
      list.splice(3, 0, '부전공' as CourseCategory);
    }
    return list;
  }, [isDoubleMajor, isMinor]);

  // 트랙별 상세 설명 문구 (교직 24학점 반영)
  const trackDescription = React.useMemo(() => {
    if (isDoubleMajor) {
      const secondMajor = profile?.double_major || '제2전공';
      return `${secondMajor} 복수전공 (주전공 50 / 복수전공 50 / 교직 24 / 교양감면 18 / 총 144학점)`;
    }
    if (isMinor) {
      const secondMajor = profile?.minor_major || '제2전공';
      return `${secondMajor} 부전공 (주전공 51 / 부전공 21 / 교직 24 / 교양 36 / 총 140학점)`;
    }
    return '단일전공 (전필 21 + 전선 51 = 전공 72 / 교직 24 / 교양 36 / 총 140학점)';
  }, [isDoubleMajor, isMinor, profile]);

  // 초기 데이터 로드
  const loadSimulatorData = async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [profileRes, completedRes, enrolledRes, plansRes] = await Promise.all([
        (supabase.from('profiles') as any).select('*').eq('id', user.id).maybeSingle(),
        (supabase.from('user_completed_courses') as any).select('credits').eq('user_id', user.id),
        (supabase.from('user_enrolled_courses') as any).select('credits').eq('user_id', user.id),
        (supabase.from('semester_plans') as any)
          .select('*, planned_courses(*)')
          .eq('user_id', user.id)
          .order('target_year', { ascending: true }),
      ]);

      let rawProfile = profileRes.data as UserProfile | null;
      if (!rawProfile && user.user_metadata) {
        rawProfile = {
          id: user.id,
          name: user.user_metadata.full_name || '',
          student_number: user.user_metadata.student_id || '',
          primary_major: user.user_metadata.primary_major || '컴퓨터교육과',
          track: user.user_metadata.major_track === 'DOUBLE' 
            ? 'DOUBLE_MAJOR' 
            : user.user_metadata.major_track === 'MINOR' 
            ? 'MINOR' 
            : 'SINGLE_MAJOR',
          double_major: user.user_metadata.secondary_major || null,
          minor_major: user.user_metadata.major_track === 'MINOR' ? user.user_metadata.secondary_major : null,
          admission_year: user.user_metadata.admission_year || 2025,
        };
      }

      if (rawProfile) {
        setProfile(rawProfile);
        if (rawProfile.admission_year) {
          setNewYear(rawProfile.admission_year + 1);
        }
      }

      const doneCredits = (completedRes.data || []).reduce(
        (sum: number, c: any) => sum + Number(c.credits || 0),
        0
      );
      setCompletedCredits(doneCredits);

      const currentCredits = (enrolledRes.data || []).reduce(
        (sum: number, c: any) => sum + Number(c.credits || 0),
        0
      );
      setEnrolledCurrentCredits(currentCredits);

      if (plansRes.data && plansRes.data.length > 0) {
        const flags: Record<string, boolean> = {};
        const loaded: SemesterPlanState[] = plansRes.data.map((p: any) => {
          const key = `${p.target_year}-${p.target_semester}`;
          if (p.is_early_graduation_target) flags[key] = true;

          const courses: PlannedCourseItem[] = (p.planned_courses || []).map((c: any) => ({
            id: c.id,
            courseName: c.course_name,
            category: c.category,
            credits: Number(c.credits),
            isSeasonalCourse: Boolean(c.is_seasonal_course),
          }));

          return {
            targetYear: p.target_year,
            targetSemester: p.target_semester,
            baseMaxCredits: Number(p.max_credits_limit || 18.0),
            carriedOverCredits: Number(p.carried_over_credits || 0.0),
            enrolledCredits: courses.reduce((sum, item) => sum + item.credits, 0),
            maxAllowedCredits: Number(p.max_credits_limit || 18.0),
            isSeasonal: p.target_semester.includes('계절'),
            courses,
          };
        });

        setHighGpaFlags(flags);
        setPlans(recalculateAllPlans(loaded, flags));
      } else {
        const baseYear = rawProfile?.admission_year || 2025;
        const defaults: SemesterPlanState[] = [];
        for (let yr = 0; yr < 4; yr++) {
          defaults.push({
            targetYear: baseYear + yr,
            targetSemester: '1학기',
            baseMaxCredits: KNU_COLLEGE_OF_EDUCATION_RULE.regularBaseCredits,
            carriedOverCredits: 0,
            enrolledCredits: 0,
            maxAllowedCredits: KNU_COLLEGE_OF_EDUCATION_RULE.regularBaseCredits,
            isSeasonal: false,
            courses: [],
          });
          defaults.push({
            targetYear: baseYear + yr,
            targetSemester: '2학기',
            baseMaxCredits: KNU_COLLEGE_OF_EDUCATION_RULE.regularBaseCredits,
            carriedOverCredits: 0,
            enrolledCredits: 0,
            maxAllowedCredits: KNU_COLLEGE_OF_EDUCATION_RULE.regularBaseCredits,
            isSeasonal: false,
            courses: [],
          });
        }
        setPlans(recalculateAllPlans(defaults, {}));
      }
    } catch (err) {
      console.error('시뮬레이터 로드 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSimulatorData();
  }, []);

  // 개설강좌 공용 검색
  const searchOfferedCourses = async (year: number, semester: string, keyword: string) => {
    setIsSearchingOffered(true);
    try {
      let query = (supabase.from('offered_courses') as any)
        .select('*')
        .eq('year', year)
        .eq('semester', semester);

      if (keyword.trim()) {
        query = query.or(
          `course_name.ilike.%${keyword.trim()}%,professor_name.ilike.%${keyword.trim()}%,course_code.ilike.%${keyword.trim()}%`
        );
      }

      const { data, error } = await query.limit(25);
      if (!error && data) {
        setOfferedList(data);
      }
    } catch (err) {
      console.error('개설강좌 검색 실패:', err);
    } finally {
      setIsSearchingOffered(false);
    }
  };

  const handleOpenPlanModal = (planKey: string) => {
    setActivePlanKey(planKey);
    const [y, s] = planKey.split('-');
    searchOfferedCourses(Number(y), s, '');
  };

  const handleToggleHighGpa = (key: string) => {
    const updated = { ...highGpaFlags, [key]: !highGpaFlags[key] };
    setHighGpaFlags(updated);
    startTransition(() => {
      setPlans((prev) => recalculateAllPlans(prev, updated));
    });
  };

  const handleAddSemester = () => {
    setNotification(null);
    const key = `${newYear}-${newSemester}`;
    if (plans.some((p) => `${p.targetYear}-${p.targetSemester}` === key)) {
      setNotification({ type: 'error', message: '이미 존재하는 학기 블록입니다.' });
      return;
    }

    const isSeasonal = newSemester.includes('계절');
    const newPlan: SemesterPlanState = {
      targetYear: newYear,
      targetSemester: newSemester,
      baseMaxCredits: isSeasonal
        ? KNU_COLLEGE_OF_EDUCATION_RULE.seasonalMaxCredits
        : KNU_COLLEGE_OF_EDUCATION_RULE.regularBaseCredits,
      carriedOverCredits: 0,
      enrolledCredits: 0,
      maxAllowedCredits: isSeasonal
        ? KNU_COLLEGE_OF_EDUCATION_RULE.seasonalMaxCredits
        : KNU_COLLEGE_OF_EDUCATION_RULE.regularBaseCredits,
      isSeasonal,
      courses: [],
    };

    const updated = [...plans, newPlan].sort((a, b) => {
      if (a.targetYear !== b.targetYear) return a.targetYear - b.targetYear;
      return a.targetSemester.localeCompare(b.targetSemester);
    });

    startTransition(() => {
      setPlans(recalculateAllPlans(updated, highGpaFlags));
    });
  };

  const handleAddOfferedCourse = (course: OfferedCourseItem) => {
    if (!activePlanKey) return;
    const targetIdx = plans.findIndex((p) => `${p.targetYear}-${p.targetSemester}` === activePlanKey);
    if (targetIdx === -1) return;

    const currentPlan = plans[targetIdx];
    const validation = validateAddCourseToPlan(currentPlan, course.credits);
    if (!validation.valid) {
      alert(validation.reason);
      return;
    }

    const newItem: PlannedCourseItem = {
      id: `offered-${course.id}-${Date.now()}`,
      courseCode: course.course_code,
      courseName: course.course_name,
      category: course.category,
      credits: course.credits,
      timetable: course.timetable || undefined,
      classroom: course.classroom || undefined,
      professorName: course.professor_name || undefined,
      isSeasonalCourse: currentPlan.isSeasonal,
    };

    const updated = [...plans];
    updated[targetIdx] = {
      ...currentPlan,
      courses: [...currentPlan.courses, newItem],
    };

    startTransition(() => {
      setPlans(recalculateAllPlans(updated, highGpaFlags));
    });
    setNotification({ type: 'success', message: `[${course.course_name}] 과목이 시간표 계획에 추가되었습니다.` });
  };

  const handleAddManualCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlanKey || !manualName.trim()) return;

    const targetIdx = plans.findIndex((p) => `${p.targetYear}-${p.targetSemester}` === activePlanKey);
    if (targetIdx === -1) return;

    const currentPlan = plans[targetIdx];
    const validation = validateAddCourseToPlan(currentPlan, manualCredits);
    if (!validation.valid) {
      alert(validation.reason);
      return;
    }

    const newItem: PlannedCourseItem = {
      id: `manual-${Date.now()}`,
      courseName: manualName.trim(),
      category: manualCategory,
      credits: manualCredits,
      isSeasonalCourse: currentPlan.isSeasonal,
    };

    const updated = [...plans];
    updated[targetIdx] = {
      ...currentPlan,
      courses: [...currentPlan.courses, newItem],
    };

    startTransition(() => {
      setPlans(recalculateAllPlans(updated, highGpaFlags));
    });

    setManualName('');
    setNotification({ type: 'success', message: '교과목이 성공적으로 추가되었습니다.' });
  };

  const handleRemoveCourse = (planKey: string, courseId: string) => {
    const updated = plans.map((p) => {
      if (`${p.targetYear}-${p.targetSemester}` === planKey) {
        return {
          ...p,
          courses: p.courses.filter((c) => c.id !== courseId),
        };
      }
      return p;
    });

    startTransition(() => {
      setPlans(recalculateAllPlans(updated, highGpaFlags));
    });
  };

  const handleDeleteSemester = (planKey: string) => {
    if (!confirm(`${planKey} 계획을 삭제하시겠습니까?`)) return;
    const filtered = plans.filter((p) => `${p.targetYear}-${p.targetSemester}` !== planKey);
    startTransition(() => {
      setPlans(recalculateAllPlans(filtered, highGpaFlags));
    });
  };

  const handleSaveToDatabase = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('로그인 세션이 만료되었습니다.');

      await (supabase.from('semester_plans') as any).delete().eq('user_id', user.id);

      for (const p of plans) {
        const key = `${p.targetYear}-${p.targetSemester}`;
        const { data: planData, error: planError } = await (supabase.from('semester_plans') as any)
          .insert({
            user_id: user.id,
            target_year: p.targetYear,
            target_semester: p.targetSemester,
            max_credits_limit: p.maxAllowedCredits,
            carried_over_credits: p.carriedOverCredits,
            is_early_graduation_target: Boolean(highGpaFlags[key]),
          })
          .select()
          .single();

        if (planError) throw planError;

        if (p.courses.length > 0 && planData) {
          const cPayload = p.courses.map((c) => ({
            plan_id: planData.id,
            course_name: c.courseName,
            category: c.category,
            credits: c.credits,
            is_seasonal_course: c.isSeasonalCourse,
          }));
          await (supabase.from('planned_courses') as any).insert(cPayload);
        }
      }

      setNotification({ type: 'success', message: '수강 계획 시뮬레이션 상태가 데이터베이스에 저장되었습니다.' });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || '저장 실패' });
    }
  };

  const totalSimulatedCredits = plans.reduce((sum, p) => sum + p.enrolledCredits, 0);
  const totalCombinedCredits = completedCredits + enrolledCurrentCredits + totalSimulatedCredits;
  const remainingCredits = Math.max(0, targetGradCredits - totalCombinedCredits);

  const regularSemesterPlans = plans.filter((p) => !p.isSeasonal);
  let earlyGraduationPossibleSemester: string | null = null;
  let runningTotal = completedCredits + enrolledCurrentCredits;

  regularSemesterPlans.forEach((plan, idx) => {
    runningTotal += plan.enrolledCredits;
    if (idx + 1 >= 6 && idx + 1 <= 7 && runningTotal >= targetGradCredits && !earlyGraduationPossibleSemester) {
      earlyGraduationPossibleSemester = `${idx + 1}학기(${plan.targetYear}년도 ${plan.targetSemester})`;
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 flex-1 w-full">
        {/* 상단 타이틀 및 액션 바 */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              TIME TABLE & GRADUATION SIMULATOR
            </span>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
              학기별 수강 및 조기졸업 시뮬레이터
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {profile?.name || '사용자'} ({profile?.primary_major || '컴퓨터교육과'} · {trackDescription})
              <span className="ml-2 font-semibold text-slate-700">| 사범대 수강 한도: 기본 18 / 우수 21 / 최대 24학점</span>
            </p>
          </div>

          {/* 액션 버튼 그룹 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsOfferedModalOpen(true)}
              className="rounded border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              개설강좌 엑셀 등록
            </button>
            <button
              onClick={handleSaveToDatabase}
              className="rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              시뮬레이션 저장
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

        {/* 종합 현황 카드 */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase text-slate-400">GRADUATION TOTAL STATUS</span>
            <p className="mt-1 text-xs text-slate-600">
              기이수 {completedCredits.toFixed(1)} + 수강 중 {enrolledCurrentCredits.toFixed(1)} + 계획 {totalSimulatedCredits.toFixed(1)}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {totalCombinedCredits.toFixed(1)} / {targetGradCredits}학점
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {remainingCredits === 0 ? '목표 졸업학점 완비' : `졸업까지 ${remainingCredits.toFixed(1)}학점 추가 계획 필요`}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase text-slate-400">CREDIT LIMIT RULE (COLLEGE OF EDUCATION)</span>
            <p className="mt-1 text-xs font-semibold text-slate-800">
              사범대학 학기당 수강신청 한도 체계
            </p>
            <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-600">
              <li>정규학기 기본 한도: <strong>18학점</strong></li>
              <li>직전학기 4.0 이상 성적우수자: <strong>21학점</strong> (+3학점)</li>
              <li>직전 정규학기 잔여 이월(최대 3학점) 적용 시: <strong>최대 24학점</strong></li>
              <li>계절학기(하계/동계) 한도: 최대 <strong>6학점</strong></li>
            </ul>
          </div>

          <div className={`rounded-lg border p-4 shadow-sm ${
            earlyGraduationPossibleSemester ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'
          }`}>
            <span className="text-[10px] font-bold uppercase text-slate-400">EARLY GRADUATION</span>
            <p className="mt-1 text-xs font-bold text-slate-900">조기졸업(6~7학기) 가능 여부 진단</p>
            {earlyGraduationPossibleSemester ? (
              <div className="mt-1.5">
                <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                  조기졸업 가능 판정
                </span>
                <p className="mt-1.5 text-xs font-medium text-emerald-900">
                  {earlyGraduationPossibleSemester} 종료 시점 학점 완비
                </p>
                <p className="text-[10px] text-emerald-700">
                  * 전 과목 누적 평점 4.0 이상 및 무시험검정 검정 요건 병행 충족 필요
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                정규 6학기 또는 7학기 종료 시점까지 {targetGradCredits}학점을 충족하는 수강 계획이 설계되면 조기졸업 가능 학기가 자동으로 표시됩니다.
              </p>
            )}
          </div>
        </div>

        {/* 학기 블록 추가 컨트롤 바 */}
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
          <span className="font-semibold text-slate-700">신규 계획 학기 추가:</span>
          <input
            type="number"
            value={newYear}
            onChange={(e) => setNewYear(Number(e.target.value))}
            className="w-24 rounded border border-slate-300 bg-white px-2 py-1 outline-none"
          />
          <select
            value={newSemester}
            onChange={(e) => setNewSemester(e.target.value as SemesterType)}
            className="rounded border border-slate-300 bg-white px-2 py-1 outline-none"
          >
            <option value="1학기">1학기</option>
            <option value="하계학기">하계학기 (계절)</option>
            <option value="2학기">2학기</option>
            <option value="동계학기">동계학기 (계절)</option>
          </select>
          <button
            onClick={handleAddSemester}
            className="rounded border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-800 hover:bg-slate-100"
          >
            학기 블록 생성
          </button>
        </div>

        {/* 학기별 카드 그리드 */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full py-16 text-center text-xs text-slate-400">
              시뮬레이션 데이터를 불러오는 중...
            </div>
          ) : (
            plans.map((plan) => {
              const planKey = `${plan.targetYear}-${plan.targetSemester}`;
              const isHighGpa = Boolean(highGpaFlags[planKey]);

              return (
                <div
                  key={planKey}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {plan.isSeasonal ? 'SEASONAL' : 'REGULAR'}
                        </span>
                        <h2 className="text-sm font-bold text-slate-900">
                          {plan.targetYear}년도 {plan.targetSemester}
                        </h2>
                      </div>

                      <button
                        onClick={() => handleDeleteSemester(planKey)}
                        className="text-xs text-slate-400 hover:text-red-600"
                      >
                        삭제
                      </button>
                    </div>

                    {/* 학점 한도 현황 박스 */}
                    <div className="mt-3 rounded bg-slate-50 p-2.5 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">신청 / 최대 허용:</span>
                        <span className="font-bold text-slate-900">
                          {plan.enrolledCredits.toFixed(1)} / {plan.maxAllowedCredits.toFixed(1)}학점
                        </span>
                      </div>

                      {!plan.isSeasonal && (
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>직전 잔여 이월 학점:</span>
                          <span>+{plan.carriedOverCredits.toFixed(1)}학점</span>
                        </div>
                      )}
                    </div>

                    {/* 4.0 이상 우수자 토글 */}
                    {!plan.isSeasonal && (
                      <label className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isHighGpa}
                          onChange={() => handleToggleHighGpa(planKey)}
                          className="rounded border-slate-300"
                        />
                        <span>성적우수(4.0이상)/조기졸업 한도(+3학점 적용)</span>
                      </label>
                    )}

                    {/* 등록된 계획 교과목 목록 */}
                    <div className="mt-4 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-700">수강 예정 과목 ({plan.courses.length})</p>
                      {plan.courses.length === 0 ? (
                        <p className="text-[11px] text-slate-400 py-2">등록된 과목이 없습니다.</p>
                      ) : (
                        <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                          {plan.courses.map((c) => (
                            <div key={c.id} className="flex items-center justify-between py-1.5 text-xs">
                              <div className="pr-2">
                                <span className="font-medium text-slate-800">{c.courseName}</span>
                                <span className="ml-1 text-[10px] text-slate-400">({c.category})</span>
                                {c.timetable && (
                                  <p className="text-[10px] text-slate-500 font-mono">
                                    {c.timetable} {c.classroom ? `| ${c.classroom}` : ''}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-700 whitespace-nowrap">{c.credits.toFixed(1)}학점</span>
                                <button
                                  onClick={() => handleRemoveCourse(planKey, c.id)}
                                  className="text-xs text-slate-400 hover:text-red-600"
                                >
                                  &times;
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenPlanModal(planKey)}
                      className="w-full rounded border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      + 개설강좌 및 과목 추가
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 개설강좌 엑셀 등록 모달 */}
        <OfferedUploadModal
          isOpen={isOfferedModalOpen}
          onClose={() => setIsOfferedModalOpen(false)}
          onSuccess={() => {
            if (activePlanKey) {
              const [y, s] = activePlanKey.split('-');
              searchOfferedCourses(Number(y), s, '');
            }
          }}
        />

        {/* 개설강좌 검색 및 시간표 담기 모달 */}
        {activePlanKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    [{activePlanKey}] 교과목 시간표 계획 등록
                  </h3>
                  <p className="text-xs text-slate-500">공용 개설강좌 검색 또는 직접 입력을 통해 계획에 반영합니다.</p>
                </div>
                <button
                  onClick={() => setActivePlanKey(null)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  닫기
                </button>
              </div>

              {/* 개설강좌 실시간 검색 바 */}
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const [y, s] = activePlanKey.split('-');
                      searchOfferedCourses(Number(y), s, searchKeyword);
                    }
                  }}
                  placeholder="과목명, 교수명, 또는 과목코드 검색"
                  className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    const [y, s] = activePlanKey.split('-');
                    searchOfferedCourses(Number(y), s, searchKeyword);
                  }}
                  className="rounded bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  검색
                </button>
              </div>

              {/* 개설강좌 검색 결과 리스트 */}
              <div className="mt-3 flex-1 overflow-y-auto border border-slate-200 rounded p-2 text-xs divide-y divide-slate-100 min-h-[160px] max-h-[220px]">
                {isSearchingOffered ? (
                  <div className="py-8 text-center text-slate-400">개설 강좌를 검색하고 있습니다...</div>
                ) : offeredList.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    해당 학기에 등록된 개설강좌가 없거나 검색 결과가 없습니다.
                  </div>
                ) : (
                  offeredList.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 hover:bg-slate-50 px-2 transition">
                      <div>
                        <span className="font-bold text-slate-900">{item.course_name}</span>
                        <span className="ml-1 text-[11px] text-slate-400">[{item.class_section}반]</span>
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {item.category}
                        </span>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {item.professor_name} 교수 | {item.credits}학점 | {item.timetable || '시간표 미지정'} {item.classroom ? `(${item.classroom})` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddOfferedCourse(item)}
                        className="rounded bg-slate-100 hover:bg-slate-900 hover:text-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition"
                      >
                        담기
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* 개별 수동 과목 입력 */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-700">개설 목록에 없는 경우 직접 입력:</span>
                <form onSubmit={handleAddManualCourse} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4 items-end text-xs">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      required
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="과목명 (예: 소프트웨어공학)"
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 outline-none focus:border-slate-800"
                    />
                  </div>
                  <div>
                    <select
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value as CourseCategory)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 outline-none focus:border-slate-800"
                    >
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <button
                      type="submit"
                      className="w-full rounded bg-slate-800 py-1.5 font-semibold text-white transition hover:bg-slate-700"
                    >
                      직접 추가
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

  
    </div>
  );
}