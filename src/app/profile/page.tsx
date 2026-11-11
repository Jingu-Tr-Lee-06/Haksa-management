// src/app/profile/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ProfileFormState {
  id: string;
  email: string;
  name: string;
  student_number: string;
  primary_major: string;
  track: 'SINGLE_MAJOR' | 'DOUBLE_MAJOR' | 'MINOR';
  secondary_major: string;
  admission_year: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [form, setForm] = useState<ProfileFormState>({
    id: '',
    email: '',
    name: '',
    student_number: '',
    primary_major: '컴퓨터교육과',
    track: 'SINGLE_MAJOR',
    secondary_major: '',
    admission_year: 2025,
  });

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push('/');
          return;
        }

        const { data: rawProfile, error: profileError } = await (supabase.from('profiles') as any)
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('프로필 조회 실패:', profileError);
        }

        const meta = (user.user_metadata || {}) as Record<string, any>;
        const p = rawProfile || {};

        const rawTrack = String(p.track || p.major_track || meta.major_track || meta.track || 'SINGLE_MAJOR').toUpperCase();
        let trackEnum: 'SINGLE_MAJOR' | 'DOUBLE_MAJOR' | 'MINOR' = 'SINGLE_MAJOR';
        if (rawTrack.includes('DOUBLE')) {
          trackEnum = 'DOUBLE_MAJOR';
        } else if (rawTrack.includes('MINOR')) {
          trackEnum = 'MINOR';
        }

        const secMajor =
          p.secondary_major ||
          p.double_major ||
          p.minor_major ||
          meta.secondary_major ||
          meta.double_major ||
          meta.minor_major ||
          '';

        setForm({
          id: user.id,
          email: user.email || '',
          name: p.name || p.full_name || meta.full_name || meta.name || '',
          student_number: p.student_number || p.student_id || meta.student_id || meta.student_number || '',
          primary_major: p.primary_major || meta.primary_major || '컴퓨터교육과',
          track: trackEnum,
          secondary_major: secMajor,
          admission_year: Number(p.admission_year || meta.admission_year || 2025),
        });
      } catch (err: any) {
        console.error('계정 데이터 로드 중 오류:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setNotification(null);

    try {
      const secMajorVal = form.track === 'SINGLE_MAJOR' ? null : form.secondary_major.trim() || null;

      const payload = {
        name: form.name.trim(),
        full_name: form.name.trim(),
        student_number: form.student_number.trim(),
        student_id: form.student_number.trim(),
        primary_major: form.primary_major.trim(),
        track: form.track,
        major_track: form.track === 'DOUBLE_MAJOR' ? 'DOUBLE' : form.track === 'MINOR' ? 'MINOR' : 'SINGLE',
        secondary_major: secMajorVal,
        double_major: form.track === 'DOUBLE_MAJOR' ? secMajorVal : null,
        minor_major: form.track === 'MINOR' ? secMajorVal : null,
        admission_year: Number(form.admission_year),
        updated_at: new Date().toISOString(),
      };

      const { error: dbError } = await (supabase.from('profiles') as any)
        .update(payload)
        .eq('id', form.id);

      if (dbError) throw dbError;

      await supabase.auth.updateUser({
        data: {
          full_name: form.name.trim(),
          student_id: form.student_number.trim(),
          primary_major: form.primary_major.trim(),
          major_track: form.track === 'DOUBLE_MAJOR' ? 'DOUBLE' : form.track === 'MINOR' ? 'MINOR' : 'SINGLE',
          track: form.track,
          secondary_major: secMajorVal,
          admission_year: Number(form.admission_year),
        },
      });

      setNotification({
        type: 'success',
        message: '계정 및 학적 정보가 데이터베이스에 성공적으로 저장되었습니다.',
      });

      router.refresh();
    } catch (err: any) {
      console.error('계정 정보 저장 오류:', err);
      setNotification({
        type: 'error',
        message: err.message || '정보 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 회원 탈퇴 및 아카이브 이관 핸들러
  const handleDeleteAccount = async () => {
    const confirmed = confirm(
      '정말로 회원 탈퇴를 진행하시겠습니까?\n학사 이력 및 성적 정보는 탈퇴 회원 아카이브(deleted_users)로 이관되며, 현재 활성 계정은 비활성화됩니다.'
    );
    if (!confirmed) return;

    const secondConfirm = prompt('탈퇴를 확정하려면 "탈퇴"라고 입력해 주십시오.');
    if (secondConfirm !== '탈퇴') {
      alert('입력값이 일치하지 않아 탈퇴 처리가 취소되었습니다.');
      return;
    }

    setIsDeleting(true);
    try {
      // 1. DB의 archive_and_delete_user 함수를 호출하여 deleted_users 테이블로 이관
      const { error } = await supabase.rpc('archive_and_delete_user');
      if (error) throw error;

      // 2. 로그아웃 및 브라우저 세션 클리어
      await supabase.auth.signOut();
      alert('회원 탈퇴 및 학사 데이터 아카이브 이관이 완료되었습니다.');
      window.location.href = '/';
    } catch (err: any) {
      console.error('회원 탈퇴 처리 실패:', err);
      alert(`탈퇴 처리 중 오류가 발생했습니다: ${err.message || '관리자에게 문의하십시오.'}`);
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 flex-1 w-full">
        {/* 상단 네비게이션 및 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ACCOUNT & ACADEMIC STATUS
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              계정 및 학적 정보 관리
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              이수 트랙(단일/복수/부전공)과 제2전공명을 수정하면 전체 시스템 사정표가 연동되어 갱신됩니다.
            </p>
          </div>
          <Link
            href="/"
            className="rounded border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            홈으로 이동
          </Link>
        </div>

        {notification && (
          <div
            className={`mt-4 rounded-lg border p-3.5 text-xs leading-relaxed ${
              notification.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {notification.message}
          </div>
        )}

        {isLoading ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
            학적 정보를 불러오는 중입니다...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {/* 기본 로그인 계정 카드 */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                포털 인증 계정
              </h2>
              <div className="mt-4 max-w-md text-xs">
                <label className="block font-semibold text-slate-600">이메일 계정 (ID)</label>
                <input
                  type="text"
                  disabled
                  value={form.email}
                  className="mt-1.5 w-full rounded border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600 cursor-not-allowed outline-none font-medium"
                />
              </div>
            </div>

            {/* 학적 세부 설정 카드 */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                학사 및 이수 트랙 사정 기준 설정
              </h2>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700">이름 (성명)</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="예: 김철수"
                    className="mt-1.5 w-full rounded border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">학번 (Student ID)</label>
                  <input
                    type="text"
                    required
                    value={form.student_number}
                    onChange={(e) => setForm({ ...form, student_number: e.target.value })}
                    placeholder="예: 202500002"
                    className="mt-1.5 w-full rounded border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">주전공</label>
                  <input
                    type="text"
                    required
                    value={form.primary_major}
                    onChange={(e) => setForm({ ...form, primary_major: e.target.value })}
                    placeholder="예: 컴퓨터교육과"
                    className="mt-1.5 w-full rounded border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">입학년도</label>
                  <input
                    type="number"
                    required
                    min={2000}
                    max={2035}
                    value={form.admission_year}
                    onChange={(e) => setForm({ ...form, admission_year: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-800"
                  />
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                  <label className="block font-semibold text-slate-700 mb-2">이수 트랙 선택</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label
                      className={`flex flex-col p-3 rounded-lg border cursor-pointer transition ${
                        form.track === 'SINGLE_MAJOR'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="track"
                        value="SINGLE_MAJOR"
                        checked={form.track === 'SINGLE_MAJOR'}
                        onChange={() => setForm({ ...form, track: 'SINGLE_MAJOR' })}
                        className="sr-only"
                      />
                      <span className="font-bold text-xs">단일전공 (심화)</span>
                      <span className={`text-[11px] mt-1 ${form.track === 'SINGLE_MAJOR' ? 'text-slate-300' : 'text-slate-400'}`}>
                        주전공 72학점 / 졸업 140학점
                      </span>
                    </label>

                    <label
                      className={`flex flex-col p-3 rounded-lg border cursor-pointer transition ${
                        form.track === 'DOUBLE_MAJOR'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="track"
                        value="DOUBLE_MAJOR"
                        checked={form.track === 'DOUBLE_MAJOR'}
                        onChange={() => setForm({ ...form, track: 'DOUBLE_MAJOR' })}
                        className="sr-only"
                      />
                      <span className="font-bold text-xs">사범계 복수전공</span>
                      <span className={`text-[11px] mt-1 ${form.track === 'DOUBLE_MAJOR' ? 'text-slate-300' : 'text-slate-400'}`}>
                        주전공 50 / 복전 50 / 실질 144학점
                      </span>
                    </label>

                    <label
                      className={`flex flex-col p-3 rounded-lg border cursor-pointer transition ${
                        form.track === 'MINOR'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="track"
                        value="MINOR"
                        checked={form.track === 'MINOR'}
                        onChange={() => setForm({ ...form, track: 'MINOR' })}
                        className="sr-only"
                      />
                      <span className="font-bold text-xs">사범계 부전공</span>
                      <span className={`text-[11px] mt-1 ${form.track === 'MINOR' ? 'text-slate-300' : 'text-slate-400'}`}>
                        주전공 51 / 부전공 21 / 졸업 140학점
                      </span>
                    </label>
                  </div>
                </div>

                {form.track !== 'SINGLE_MAJOR' && (
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700">
                      {form.track === 'DOUBLE_MAJOR' ? '복수전공 학과명' : '부전공 학과명'}
                    </label>
                    <input
                      type="text"
                      required
                      value={form.secondary_major}
                      onChange={(e) => setForm({ ...form, secondary_major: e.target.value })}
                      placeholder="예: 수학교육과, 기술·가정교육과, 물리교육과 등"
                      className="mt-1.5 w-full rounded border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-800"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      입력하신 학과명이 성적표 및 사정표의 헤더 탭 라벨로 자동 연결됩니다.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving || isDeleting}
                className="rounded-lg bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-slate-800 disabled:bg-slate-400"
              >
                {isSaving ? '저장 및 사정표 동기화 중...' : '학적 정보 저장'}
              </button>
            </div>

            {/* 회원 탈퇴 (데이터 아카이브 이관) 카드 */}
            <div className="mt-12 rounded-xl border border-red-200 bg-red-50/40 p-6 shadow-sm">
              <h2 className="text-sm font-bold text-red-900">회원 탈퇴</h2>
              <p className="mt-1 text-xs text-red-700 leading-relaxed">
                탈퇴 시 회원의 계정과 누적 성적, 수강 내역, 비교과 검정 데이터는 감사 및 기록 보존을 위해 <strong>탈퇴 회원 아카이브(deleted_users)</strong>로 안전하게 이관 보관되며, 현재 로그인 세션은 파기됩니다.
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={isDeleting || isSaving}
                  onClick={handleDeleteAccount}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
                >
                  {isDeleting ? '아카이브 이관 처리 중...' : '회원 탈퇴 실행'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      
    </div>
  );
}