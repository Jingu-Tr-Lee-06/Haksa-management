'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [admissionYear, setAdmissionYear] = useState('');
  const [primaryMajor, setPrimaryMajor] = useState('');
  const [track, setTrack] = useState<'SINGLE_MAJOR' | 'DOUBLE_MAJOR' | 'MINOR' | ''>('');
  const [doubleMajor, setDoubleMajor] = useState('');
  const [minorMajor, setMinorMajor] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== passwordConfirm) {
      setErrorMessage('비밀번호와 비밀번호 확인이 일치하지 않는다.');
      return;
    }

    if (!track) {
      setErrorMessage('이수 트랙(단일전공, 복수전공, 부전공)을 선택해야 한다.');
      return;
    }

    if (!admissionYear || isNaN(Number(admissionYear))) {
      setErrorMessage('입학년도를 숫자로 올바르게 입력해야 한다.');
      return;
    }

    setIsLoading(true);

    try {
      const redirectUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : 'http://localhost:3000/auth/callback';

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: name.trim(),
            student_number: studentNumber.trim(),
            admission_year: Number(admissionYear),
            primary_major: primaryMajor.trim(),
            track: track === 'MINOR' ? 'SINGLE_MAJOR' : track,
            double_major: track === 'DOUBLE_MAJOR' ? doubleMajor.trim() : null,
            minor_major: track === 'MINOR' ? minorMajor.trim() : null,
          },
        },
      });

      if (authError) throw authError;

      // Email Confirm이 비활성화되어 즉시 세션이 발급된 경우 직접 프로필 적재
      if (authData.session && authData.user) {
        await (supabase.from('profiles') as any).upsert({
          id: authData.user.id,
          student_number: studentNumber.trim(),
          name: name.trim(),
          primary_major: primaryMajor.trim(),
          track: track === 'MINOR' ? 'SINGLE_MAJOR' : track,
          double_major: track === 'DOUBLE_MAJOR' ? doubleMajor.trim() : null,
          minor_major: track === 'MINOR' ? minorMajor.trim() : null,
          admission_year: Number(admissionYear),
        });

        await (supabase.from('user_non_subject_records') as any).upsert({
          user_id: authData.user.id,
          gender_equity_education_count: 0,
          teaching_aptitude_test_count: 0,
          cpr_training_count: 0,
          volunteer_hours: 0,
          narcotics_test_submitted: false,
          korean_history_certified: false,
        });

        router.push('/');
        router.refresh();
        return;
      }

      setIsSuccess(true);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : '학생 등록 중 오류가 발생하였다.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 font-bold">
            ✓
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">인증 메일 발송 완료</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            <strong className="text-slate-800">{email}</strong> 계정으로 인증 이메일을 발송하였다.<br />
            메일함에서 안내 링크를 확인한 뒤 로그인해야 한다.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-block w-full rounded-lg bg-slate-900 py-3 text-xs font-bold text-white transition hover:bg-slate-800"
            >
              메인 화면으로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            신규 회원가입
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            학사 졸업 사정을 위한 소속 학과 및 트랙 정보를 입력해야 한다.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700">이메일 (아이디)</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@smail.kongju.ac.kr"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-800 placeholder:text-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700">비밀번호</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자리 이상"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-800 placeholder:text-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700">비밀번호 확인</label>
              <input
                type="password"
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="동일 비밀번호 재입력"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-800 placeholder:text-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700">성명</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 홍길동"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-800 placeholder:text-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700">학번</label>
              <input
                type="text"
                required
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                placeholder="예: 202500000"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-800 placeholder:text-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700">입학년도</label>
              <input
                type="number"
                required
                value={admissionYear}
                onChange={(e) => setAdmissionYear(e.target.value)}
                placeholder="예: 2025"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-800 placeholder:text-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700">이수 트랙</label>
              <select
                required
                value={track}
                onChange={(e) => setTrack(e.target.value as any)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-800 text-slate-800"
              >
                <option value="" disabled className="text-slate-300">
                  트랙을 선택하십시오
                </option>
                <option value="SINGLE_MAJOR">단일전공 (심화 - 140학점)</option>
                <option value="DOUBLE_MAJOR">복수전공 (144학점 이상)</option>
                <option value="MINOR">부전공 (140학점 체계)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700">주전공</label>
            <input
              type="text"
              required
              value={primaryMajor}
              onChange={(e) => setPrimaryMajor(e.target.value)}
              placeholder="예: 컴퓨터교육과"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-800 placeholder:text-slate-300"
            />
          </div>

          {track === 'DOUBLE_MAJOR' && (
            <div>
              <label className="block font-semibold text-slate-700">복수전공 학과명</label>
              <input
                type="text"
                required
                value={doubleMajor}
                onChange={(e) => setDoubleMajor(e.target.value)}
                placeholder="예: 기술·가정교육과"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-800 placeholder:text-slate-300"
              />
            </div>
          )}

          {track === 'MINOR' && (
            <div>
              <label className="block font-semibold text-slate-700">부전공 표시과목 학과명</label>
              <input
                type="text"
                required
                value={minorMajor}
                onChange={(e) => setMinorMajor(e.target.value)}
                placeholder="예: 기술·가정교육과 (부전공 이수 21학점 이상)"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-800 placeholder:text-slate-300"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-slate-900 py-3 font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
          >
            {isLoading ? '등록 중...' : '회원가입 완료'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          이미 등록된 계정이 있는가?{' '}
          <Link
            href="/"
            className="font-bold text-slate-900 underline underline-offset-4 hover:text-slate-700"
          >
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}