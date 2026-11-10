'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

function QuickLoginForm({
  onLoginSuccess,
}: {
  onLoginSuccess: (profile: Profile) => void;
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
          throw new Error('이메일 인증이 완료되지 않았습니다. 메일함에서 확인 링크를 클릭하거나 관리자 승인을 받으십시오.');
        } else if (authError.message.includes('Invalid login credentials')) {
          throw new Error('이메일 또는 비밀번호가 일치하지 않습니다.');
        }
        throw authError;
      }

      if (authData.user) {
        // profiles 조회 시도
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (profileData) {
          onLoginSuccess(profileData as Profile);
        } else {
          // profiles 레코드가 누락된 경우 auth 메타데이터로 임시 생성 및 fallback
          const meta = authData.user.user_metadata || {};
          const fallbackProfile = {
            id: authData.user.id,
            name: meta.name || '학생',
            student_number: meta.student_number || '',
            primary_major: meta.primary_major || '컴퓨터교육과',
            track: meta.track || 'DOUBLE_MAJOR',
            double_major: meta.double_major || '기술가정교육과',
            admission_year: meta.admission_year || 2025,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Profile;

          await (supabase.from('profiles') as any).upsert(fallbackProfile);
          onLoginSuccess(fallbackProfile);
        }
      }

      // 화면 상태 즉시 반영
      window.location.reload();
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadUserData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (data) {
            setProfile(data as Profile);
          } else {
            // profiles 테이블 조회가 비었을 때 metadata로 임시 표시
            const meta = user.user_metadata || {};
            setProfile({
              id: user.id,
              name: meta.name || '학생',
              student_number: meta.student_number || '',
              primary_major: meta.primary_major || '컴퓨터교육과',
              track: meta.track || 'DOUBLE_MAJOR',
              double_major: meta.double_major || '기술가정교육과',
              admission_year: meta.admission_year || 2025,
            } as Profile);
          }
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
    window.location.reload();
  };

  return (
    <div className="relative min-h-[calc(100vh-140px)] overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="pointer-events-none absolute -top-40 right-[-10%] h-[600px] w-[600px] rounded-full bg-slate-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-60 -left-20 h-[450px] w-[450px] rounded-full bg-blue-100/30 blur-3xl" />

      {/* 히어로 섹션 */}
      <section className="relative mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-16 lg:pb-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* 좌측 슬로건 및 지표 영역 */}
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
              컴퓨터교육과 단일심화(140학점), 사범계 복수전공(144학점 이상, 기술·가정 등), 부전공(140학점 체계)
              교육과정에 따른 기본이수 7개 분야, 교과교육 8학점, 법정 교직 22학점 및 무시험검정 6대 지표를 완벽 판정합니다.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-slate-200 pt-6">
              <div>
                <p className="text-[11px] font-medium text-slate-500">졸업 기준 학점</p>
                <p className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">140 / 144</p>
                <p className="text-[10px] text-slate-400">단일·부전공 / 복수전공</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500">법정 교직 이수</p>
                <p className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">22학점</p>
                <p className="text-[10px] text-slate-400">이론 12 · 소양 6 · 실습 4</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500">무시험검정 지표</p>
                <p className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">6종 충족</p>
                <p className="text-[10px] text-slate-400">인적성·CPR·성인지·봉사 등</p>
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

          {/* 우측 로그인 / 프로필 카드 */}
          <div className="lg:col-span-5">
            {!isLoading && (
              <>
                {profile ? (
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl sm:p-8">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      AUTHENTICATED STUDENT
                    </span>
                    <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                      {profile.name} 학생
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
                          {profile.track === 'DOUBLE_MAJOR'
                            ? `복수전공 (${profile.double_major || '복수전공'})`
                            : (profile as any).track === 'MINOR'
                            ? `부전공 (${(profile as any).minor_major || '부전공'})`
                            : '단일전공 (심화)'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">목표 졸업 학점</span>
                        <span className="font-bold text-slate-900">
                          {profile.track === 'DOUBLE_MAJOR' ? '144학점 이상' : '140학점 이상'}
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
                        href="/curriculum"
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
                  <Suspense fallback={<div className="h-80 w-full animate-pulse rounded-2xl bg-slate-100" />}>
                    <QuickLoginForm onLoginSuccess={(p) => setProfile(p)} />
                  </Suspense>
                )}
              </>
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
            단일심화전공, 타 사범계열 복수전공 및 부전공 이수 시 적용되는 법정 기준표입니다.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
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
                  <span className="font-bold text-slate-900">75학점 이상</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">기본이수과목</span>
                  <span className="font-semibold text-slate-800">7개 분야 (21학점)</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">교과교육영역</span>
                  <span className="font-semibold text-slate-800">3과목 (8학점)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">취득 교원자격</span>
                  <span className="font-bold text-emerald-600">중등학교 정교사(2급)</span>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              전공 평점 75점(2.01) 및 교직 80점(2.51) 충족 필수
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border-2 border-slate-800 bg-white p-6 shadow-sm">
            <div>
              <div className="inline-block rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
                트랙 02 (추천)
              </div>
              <h3 className="mt-2 text-lg font-bold text-slate-900">사범계 복수전공</h3>
              <p className="mt-1 text-xs text-slate-500">기술·가정교육과 등 타 사범계열 병행</p>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">실질 졸업 학점</span>
                  <span className="font-bold text-slate-900">144학점 이상</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">주전공 이수</span>
                  <span className="font-bold text-slate-900">50학점 이상</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">복수전공 이수</span>
                  <span className="font-bold text-slate-900">50학점 이상</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">교과교육영역</span>
                  <span className="font-semibold text-slate-800">각 전공별 3과목(8학점)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">취득 교원자격</span>
                  <span className="font-bold text-emerald-600">2개 표시과목 동시 취득</span>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              두 전공 모두 기본이수 7개 분야 충족 및 교과교육 필수
            </div>
          </div>

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
                  <span className="font-bold text-slate-900">50학점 이상</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">부전공 과목 이수</span>
                  <span className="font-bold text-slate-900">21학점 이상</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-500">기본이수과목</span>
                  <span className="font-semibold text-slate-800">부전공 분야 15학점 이상</span>
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

      {/* 파트너 대학 바 */}
      <section className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
            국립공주대학교 사범대학 학사 규정 및 교육 협력 체계
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 text-xs font-semibold text-slate-500 opacity-80 sm:gap-14">
            <span className="hover:text-slate-900">국립공주대학교 사범대학</span>
            <span className="hover:text-slate-900">컴퓨터교육과</span>
            <span className="hover:text-slate-900">기술·가정교육과</span>
            <span className="hover:text-slate-900">교원양성지원센터</span>
            <span className="hover:text-slate-900">사범대학 교직부</span>
          </div>
        </div>
      </section>
    </div>
  );
}
