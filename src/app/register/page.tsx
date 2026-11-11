'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MajorTrack } from '@/types/curriculum';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [admissionYear, setAdmissionYear] = useState('2025');

  // 전공 트랙 상태 관리
  const [majorTrack, setMajorTrack] = useState<MajorTrack>('SINGLE');
  const [secondaryMajorName, setSecondaryMajorName] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isConfirmationSent, setIsConfirmationSent] = useState(false);

  const isPasswordMismatch = password.length > 0 && passwordConfirm.length > 0 && password !== passwordConfirm;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    if (password !== passwordConfirm) {
      setErrorMessage('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    if (majorTrack !== 'SINGLE' && !secondaryMajorName.trim()) {
      setErrorMessage(
        majorTrack === 'DOUBLE'
          ? '복수전공 학과명을 입력해 주십시오.'
          : '부전공 학과명을 입력해 주십시오.'
      );
      setLoading(false);
      return;
    }

    try {
      const dbTrackEnum =
        majorTrack === 'DOUBLE'
          ? 'DOUBLE_MAJOR'
          : majorTrack === 'MINOR'
          ? 'MINOR'
          : 'SINGLE_MAJOR';

      const secMajor = majorTrack === 'SINGLE' ? null : secondaryMajorName.trim();

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            name: name.trim(),
            student_id: studentId.trim(),
            student_number: studentId.trim(),
            admission_year: parseInt(admissionYear, 10),
            primary_major: '컴퓨터교육과',
            track: dbTrackEnum,
            major_track: majorTrack,
            secondary_major: secMajor,
            double_major: majorTrack === 'DOUBLE' ? secMajor : null,
            minor_major: majorTrack === 'MINOR' ? secMajor : null,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data?.user) {
        const profilePayload = {
          id: data.user.id,
          name: name.trim(),
          full_name: name.trim(),
          student_number: studentId.trim(),
          student_id: studentId.trim(),
          admission_year: parseInt(admissionYear, 10),
          primary_major: '컴퓨터교육과',
          track: dbTrackEnum,
          major_track: majorTrack,
          secondary_major: secMajor,
          double_major: majorTrack === 'DOUBLE' ? secMajor : null,
          minor_major: majorTrack === 'MINOR' ? secMajor : null,
          updated_at: new Date().toISOString(),
        };

        const { error: profileError } = await (supabase.from('profiles') as any).upsert(
          profilePayload,
          { onConflict: 'id' }
        );

        if (profileError) {
          console.warn('Profile sync note:', profileError.message || profileError);
        }

        if (!data.session) {
          setIsConfirmationSent(true);
        } else {
          // 가입 성공 즉시 메인 랜딩페이지로 이동
          router.push('/');
          router.refresh();
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('회원가입 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between text-gray-900">
      <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900">
            국립공주대학교 학사 관리 시스템
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            사범대학 컴퓨터교육과 학생 맞춤형 졸업 사정 등록
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
          <div className="bg-white py-8 px-6 shadow-sm border border-gray-200 rounded-lg sm:px-10">
            {isConfirmationSent ? (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 border border-blue-200">
                  <span className="text-blue-600 font-bold text-sm">MAIL</span>
                </div>
                <h3 className="text-base font-bold text-gray-900">
                  인증 메일이 발송되었습니다
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  <strong className="text-gray-900">{email}</strong> 주소로 인증 링크를 전송했습니다.<br />
                  수신함(또는 스팸메일함)을 확인하여 링크를 클릭하시면 회원가입이 완료됩니다.
                </p>
                <div className="pt-4 border-t border-gray-100">
                  <Link
                    href="/"
                    className="inline-block w-full rounded-md bg-gray-900 py-2.5 px-4 text-xs font-semibold text-white shadow-sm hover:bg-gray-800 transition"
                  >
                    홈으로 이동
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {errorMessage && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                    {errorMessage}
                  </div>
                )}

                <form className="space-y-4" onSubmit={handleRegister}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">이메일</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@smail.kongju.ac.kr"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">비밀번호</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8자 이상 입력"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">비밀번호 확인</label>
                    <input
                      type="password"
                      required
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="비밀번호 재입력"
                      className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
                        isPasswordMismatch
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-gray-900 focus:ring-gray-900'
                      }`}
                    />
                    {isPasswordMismatch && (
                      <p className="mt-1 text-xs text-red-600">
                        비밀번호가 일치하지 않습니다.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">이름</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="홍길동"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">학번</label>
                      <input
                        type="text"
                        required
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="202500000"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">입학년도</label>
                      <input
                        type="number"
                        required
                        value={admissionYear}
                        onChange={(e) => setAdmissionYear(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">주전공</label>
                      <input
                        type="text"
                        disabled
                        value="컴퓨터교육과"
                        className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600 shadow-sm cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      이수 트랙 구분
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMajorTrack('SINGLE');
                          setSecondaryMajorName('');
                        }}
                        className={`py-2 text-sm font-medium rounded-md border transition-colors ${
                          majorTrack === 'SINGLE'
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        단일전공
                      </button>
                      <button
                        type="button"
                        onClick={() => setMajorTrack('DOUBLE')}
                        className={`py-2 text-sm font-medium rounded-md border transition-colors ${
                          majorTrack === 'DOUBLE'
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        복수전공
                      </button>
                      <button
                        type="button"
                        onClick={() => setMajorTrack('MINOR')}
                        className={`py-2 text-sm font-medium rounded-md border transition-colors ${
                          majorTrack === 'MINOR'
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        부전공
                      </button>
                    </div>
                  </div>

                  {majorTrack !== 'SINGLE' && (
                    <div className="pt-2 transition-all">
                      <label className="block text-sm font-medium text-gray-700">
                        {majorTrack === 'DOUBLE' ? '복수전공 학과명' : '부전공 학과명'}
                      </label>
                      <input
                        type="text"
                        required
                        value={secondaryMajorName}
                        onChange={(e) => setSecondaryMajorName(e.target.value)}
                        placeholder="예: 기술·가정교육과, 수학교육과"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading || isPasswordMismatch}
                      className="w-full rounded-md bg-gray-900 py-2.5 px-4 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:bg-gray-400 transition-colors"
                    >
                      {loading ? '등록 처리 중...' : '회원가입 및 학사 설정 완료'}
                    </button>
                  </div>
                </form>

                <div className="mt-6 text-center text-sm">
                  <span className="text-gray-500">이미 계정이 있으신가요? </span>
                  <Link href="/" className="font-medium text-gray-900 underline">
                    로그인
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

    
    </div>
  );
}