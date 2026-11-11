// src/app/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface UserProfileData {
  id: string;
  name: string;
  student_number: string;
  primary_major: string;
  major_track: 'SINGLE' | 'DOUBLE' | 'MINOR';
  secondary_major: string | null;
  admission_year: number;
}

function getValidString(...candidates: any[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return c.trim();
    }
  }
  return '';
}

function QuickLoginForm({
  onLoginSuccess,
}: {
  onLoginSuccess: (profile: UserProfileData) => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        if (authError.message.includes('Email not confirmed')) {
          throw new Error('이메일 인증이 완료되지 않았습니다. 메일함을 확인하거나 관리자에게 문의하십시오.');
        } else if (authError.message.includes('Invalid login credentials')) {
          throw new Error('이메일 또는 비밀번호가 일치하지 않습니다.');
        }
        throw authError;
      }

      if (authData.user) {
        // DB profiles 직접 조회
        const { data: rawProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        const profileData = (rawProfile || {}) as Record<string, any>;
        const meta = (authData.user.user_metadata || {}) as Record<string, any>;

        // DB track 컬럼 우선 판정
        const rawTrack = String(
          profileData.track ||
          profileData.major_track ||
          meta.major_track ||
          meta.track ||
          'SINGLE'
        ).toUpperCase();

        const resolvedTrack: 'SINGLE' | 'DOUBLE' | 'MINOR' = rawTrack.includes('DOUBLE')
          ? 'DOUBLE'
          : rawTrack.includes('MINOR')
          ? 'MINOR'
          : 'SINGLE';

        const secMajor =
          profileData.secondary_major ||
          profileData.double_major ||
          profileData.minor_major ||
          meta.secondary_major ||
          meta.double_major ||
          meta.minor_major ||
          null;

        const resolvedName =
          getValidString(
            profileData.name,
            profileData.full_name,
            meta.full_name,
            meta.name
          ) || authData.user.email?.split('@')[0] || '사용자';

        const unifiedProfile: UserProfileData = {
          id: authData.user.id,
          name: resolvedName,
          student_number:
            getValidString(
              profileData.student_number,
              profileData.student_id,
              meta.student_id,
              meta.student_number
            ) || '202500000',
          primary_major:
            getValidString(profileData.primary_major, meta.primary_major) || '컴퓨터교육과',
          major_track: resolvedTrack,
          secondary_major: secMajor,
          admission_year: profileData.admission_year || meta.admission_year || 2025,
        };

        onLoginSuccess(unifiedProfile);
        router.refresh();
      }
    } catch (err) {
      console.error('로그인 에러:', err);
      setErrorMessage(
        err instanceof Error ? err.message : '로그인 처리 중 오류가 발생했습니다.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl sm:p-8">
      <div className="mb-5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          STUDENT PORTAL LOGIN
        </span>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          학사 진단 시스템 로그인
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          공주대학교 사범대학 포털 계정으로 로그인하십시오.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-slate-700">이메일 계정</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@smail.kongju.ac.kr"
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:border-slate-800 focus:ring-1 focus:ring-slate-800 placeholder:text-slate-300"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700">비밀번호</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:border-slate-800 focus:ring-1 focus:ring-slate-800 placeholder:text-slate-300"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-slate-900 py-3 text-xs font-bold text-white shadow-md transition hover:bg-slate-800 disabled:bg-slate-400"
        >
          {isLoading ? '인증 처리 중...' : '시스템 로그인'}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>신규 등록 대상자이십니까?</span>
        <Link
          href="/register"
          className="font-bold text-slate-900 underline underline-offset-4 hover:text-slate-700"
        >
          학생 등록
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadUserData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: rawProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          const profileData = (rawProfile || {}) as Record<string, any>;
          const meta = (user.user_metadata || {}) as Record<string, any>;

          // DB의 track 컬럼 값을 최우선 반영
          const rawTrack = String(
            profileData.track ||
            profileData.major_track ||
            meta.major_track ||
            meta.track ||
            'SINGLE'
          ).toUpperCase();

          const resolvedTrack: 'SINGLE' | 'DOUBLE' | 'MINOR' = rawTrack.includes('DOUBLE')
            ? 'DOUBLE'
            : rawTrack.includes('MINOR')
            ? 'MINOR'
            : 'SINGLE';

          const secMajor =
            profileData.secondary_major ||
            profileData.double_major ||
            profileData.minor_major ||
            meta.secondary_major ||
            meta.double_major ||
            meta.minor_major ||
            null;

          const resolvedName =
            getValidString(
              profileData.name,
              profileData.full_name,
              meta.full_name,
              meta.name
            ) || user.email?.split('@')[0] || '사용자';

          setProfile({
            id: user.id,
            name: resolvedName,
            student_number:
              getValidString(
                profileData.student_number,
                profileData.student_id,
                meta.student_id,
                meta.student_number
              ) || '202500000',
            primary_major:
              getValidString(profileData.primary_major, meta.primary_major) || '컴퓨터교육과',
            major_track: resolvedTrack,
            secondary_major: secMajor,
            admission_year: profileData.admission_year || meta.admission_year || 2025,
          });
        }
      } catch (err) {
        console.error('사용자 데이터 로드 실패:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadUserData();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    router.refresh();
  };

  const trackLabel = profile?.major_track === 'DOUBLE'
    ? `복수전공 (${profile.secondary_major || '제2전공'})`
    : profile?.major_track === 'MINOR'
    ? `부전공 (${profile.secondary_major || '제2전공'})`
    : '단일전공 (심화)';

  const targetCredits = profile?.major_track === 'DOUBLE' ? '144학점 이상' : '140학점 이상';

  return (
    <div className="relative min-h-[calc(100vh-140px)] overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="pointer-events-none absolute -top-40 right-[-10%] h-[600px] w-[600px] rounded-full bg-slate-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-60 -left-20 h-[450px] w-[450px] rounded-full bg-blue-100/30 blur-3xl" />

      {/* 히어로 섹션 */}
      <section className="relative mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-16 lg:pb-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-3.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>국립공주대학교 사범대학 예비교원 학사 플랫폼</span>
            </div>

            <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-900 sm:text-5xl sm:leading-tight">
              내 손안의 학사·교직 사정.
              <br />
              <span className="text-slate-800">
                디지털로, 엄밀하게.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              컴퓨터교육과 단일심화(140학점), 사범계 복수전공(144학점 이상), 부전공(140학점 체계)
              교육과정에 따른 전공필수 21학점(7과목), 교과교육 8학점, 법정 교직 24학점 및 캡스톤디자인Ⅱ 졸업요건을 완벽 판정합니다.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-slate-200 pt-6">
              <div>
                <p className="text-[11px] font-medium text-slate-500">졸업 기준 학점</p>
                <p className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">140 / 144</p>
                <p className="text-[10px] text-slate-400">단일·부전공(140) / 복수(144)</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500">법정 교직 이수</p>
                <p className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">24학점</p>
                <p className="text-[10px] text-slate-400">이론 12 · 소양 8 · 실습 4</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500">학과 필수 요건</p>
                <p className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">캡스톤Ⅱ</p>
                <p className="text-[10px] text-slate-400">졸업논문 대체 교과목</p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/audit"
                className="rounded-lg bg-slate-900 px-6 py-3 text-xs font-bold text-white shadow-md transition hover:bg-slate-800"
              >
                졸업 사정 시작하기
              </Link>
              <Link
                href="/regulations"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                학사·예규 규정 질의 (RAG)
              </Link>
            </div>
          </div>

          {/* 우측 로그인 폼 / 프로필 카드 */}
          <div className="lg:col-span-5 min-h-[380px] flex items-center">
            {isLoading ? (
              <div className="w-full h-80 animate-pulse rounded-2xl border border-slate-200 bg-slate-50/70 p-6 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-4 w-28 bg-slate-200 rounded" />
                  <div className="h-6 w-48 bg-slate-200 rounded" />
                  <div className="h-3 w-64 bg-slate-200 rounded" />
                </div>
                <div className="space-y-3">
                  <div className="h-10 w-full bg-slate-200 rounded-lg" />
                  <div className="h-10 w-full bg-slate-200 rounded-lg" />
                </div>
                <div className="h-10 w-full bg-slate-300 rounded-lg" />
              </div>
            ) : profile ? (
              <div className="w-full rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl sm:p-8">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  AUTHENTICATED STUDENT
                </span>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  {profile.name}
                </h2>
                <p className="text-xs text-slate-500">
                  학번: {profile.student_number || '학번 미지정'} | {profile.admission_year}년도 입학
                </p>

                <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">주전공</span>
                    <span className="font-bold text-slate-900">{profile.primary_major}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">이수 트랙</span>
                    <span className="font-bold text-slate-900">
                      {trackLabel}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">목표 졸업 학점</span>
                    <span className="font-bold text-slate-900">
                      {targetCredits}
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-2 text-center text-xs">
                  <Link
                    href="/audit"
                    className="rounded-lg bg-slate-900 py-2.5 font-bold text-white transition hover:bg-slate-800"
                  >
                    내 사정 리포트
                  </Link>
                  <Link
                    href="/simulator"
                    className="rounded-lg border border-slate-300 bg-white py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    성적 관리
                  </Link>
                </div>

                <button
                  onClick={handleLogout}
                  className="mt-3 w-full py-2 text-center text-xs text-slate-400 hover:text-slate-600"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="w-full">
                <QuickLoginForm onLoginSuccess={(p) => setProfile(p)} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3대 트랙 요건 비교 */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="border-b border-slate-200 pb-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            ACADEMIC TRACK SPECIFICATION
          </span>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            사범대학 전공 이수 트랙별 졸업 및 교원자격 무시험검정 기준
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            단일전공(심화), 사범계 복수전공 및 부전공 이수 시 적용되는 법정 기준표입니다.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* 트랙 01: 단일전공 */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <div className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                트랙 01
              </div>
              <h3 className="mt-2 text-lg font-bold text-slate-900">단일전공 (심화과정)</h3>
              <p className="mt-1 text-xs text-slate-500">컴퓨터교육과 단일 전공 심화 이수</p>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">최저 졸업 학점</span>
                  <span className="font-bold text-slate-900">140학점 이상</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">전공 이수 요건</span>
                  <span className="font-bold text-slate-900">72학점 이상 (필수21+선택51)</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">교양 이수 요건</span>
                  <span className="font-semibold text-slate-800">36학점 (균형선택 12 이상)</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">법정 교직과목</span>
                  <span className="font-semibold text-slate-800">24학점 (이론12·소양8·실습4)</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">학과 필수 요건</span>
                  <span className="font-bold text-slate-900">캡스톤디자인Ⅱ 이수 필수</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">취득 교원자격</span>
                  <span className="font-bold text-emerald-600">중등학교 정교사(2급)</span>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              균형교양은 3개 영역 이상 이수 필수
            </div>
          </div>

          {/* 트랙 02: 복수전공 */}
          <div className="flex flex-col justify-between rounded-xl border-2 border-slate-800 bg-white p-6 shadow-sm">
            <div>
              <div className="inline-block rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
                트랙 02 (추천)
              </div>
              <h3 className="mt-2 text-lg font-bold text-slate-900">사범계 복수전공</h3>
              <p className="mt-1 text-xs text-slate-500">타 사범계열 학과 병행 이수</p>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">실질 졸업 학점</span>
                  <span className="font-bold text-slate-900">144학점 이상</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">주전공 이수</span>
                  <span className="font-bold text-slate-900">50학점 이상 (필수21+선택30)</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">복수전공 이수</span>
                  <span className="font-bold text-slate-900">50학점 이상</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">교양 이수 요건</span>
                  <span className="font-semibold text-slate-800">18학점 (균형선택 8 이상 감면)</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">법정 교직과목</span>
                  <span className="font-semibold text-slate-800">24학점 (이론12·소양8·실습4)</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">학과 필수 요건</span>
                  <span className="font-bold text-slate-900">캡스톤디자인Ⅱ 이수 필수</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">취득 교원자격</span>
                  <span className="font-bold text-emerald-600">2개 표시과목 동시 취득</span>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              양 전공 모두 기본이수 7개 분야 및 교과교육 8학점 필수 충족
            </div>
          </div>

          {/* 트랙 03: 부전공 */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <div className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                트랙 03
              </div>
              <h3 className="mt-2 text-lg font-bold text-slate-900">사범계 부전공</h3>
              <p className="mt-1 text-xs text-slate-500">부전공 표시과목 자격 취득 과정</p>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">최저 졸업 학점</span>
                  <span className="font-bold text-slate-900">140학점 이상</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">주전공 이수</span>
                  <span className="font-bold text-slate-900">51학점 이상 (필수21+선택30)</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">부전공 과목 이수</span>
                  <span className="font-bold text-slate-900">21학점 이상 (기본이수 15 포함)</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">교양 이수 요건</span>
                  <span className="font-semibold text-slate-800">36학점 (균형선택 12 이상)</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">법정 교직과목</span>
                  <span className="font-semibold text-slate-800">24학점 (이론12·소양8·실습4)</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">학과 필수 요건</span>
                  <span className="font-bold text-slate-900">캡스톤디자인Ⅱ 이수 필수</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">취득 교원자격</span>
                  <span className="font-bold text-emerald-600">주전공 자격증 내 부전공 표기</span>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              교직과정 설치 학과에 한하며 교원자격증에 부전공 표시과목 표기
            </div>
          </div>
        </div>
      </section>

    

      {/* Footer */}
    </div>
  );
}