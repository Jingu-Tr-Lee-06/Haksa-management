'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get('redirectedFrom') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      router.push(redirectedFrom);
      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : '로그인 인증에 실패하였습니다. 학번 및 비밀번호를 확인하십시오.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6 text-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          KNU ACADEMIC ADVISOR
        </span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          통합 학사 및 졸업사정 시스템
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          국립공주대학교 사범대학 컴퓨터교육과
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-slate-700">
            이메일 주소
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@sportal.kongju.ac.kr"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-800"
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700">
            비밀번호
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하십시오"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-800"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded bg-slate-900 py-2.5 font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
        >
          {isLoading ? '인증 처리 중...' : '로그인'}
        </button>
      </form>

      <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
        신규 학사 대상자이십니까?{' '}
        <Link
          href="/register"
          className="font-semibold text-slate-900 underline underline-offset-4 hover:text-slate-700"
        >
          학생 등록
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="text-center text-xs text-slate-400">
            로그인 인터페이스를 준비하고 있습니다...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}