// src/app/auth/confirmed/page.tsx
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AuthConfirmedPage() {
  const router = useRouter();

  useEffect(() => {
    // 3초 후 시뮬레이터로 자동 이동
    const timer = setTimeout(() => {
      router.push('/simulator');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between text-gray-900">
      <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900">
            국립공주대학교 학사 관리 시스템
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            계정 이메일 인증 완료
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
          <div className="bg-white py-10 px-6 shadow-sm border border-gray-200 rounded-lg sm:px-10 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
              <span className="text-emerald-700 font-bold text-xs">확인</span>
            </div>

            <h3 className="text-base font-bold text-gray-900">
              이메일 인증이 성공적으로 완료되었습니다
            </h3>

            <p className="text-xs text-gray-600 leading-relaxed">
              사범대학 컴퓨터교육과 학생 계정이 활성화되었습니다.<br />
              잠시 후 학사 시뮬레이터 화면으로 자동 이동합니다.
            </p>

            <div className="pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => router.push('/simulator')}
                className="w-full rounded-md bg-gray-900 py-2.5 px-4 text-xs font-semibold text-white shadow-sm hover:bg-gray-800 transition"
              >
                시뮬레이터로 즉시 이동
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-gray-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-gray-500 space-y-2">
          <div className="flex justify-center space-x-6">
            <a
              href="https://www.notion.so"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 underline"
            >
              개인정보처리방침
            </a>
            <a
              href="https://www.notion.so"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 underline"
            >
              서비스 이용약관
            </a>
            <a
              href="https://www.notion.so"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 underline"
            >
              서비스 설명
            </a>
            <a
              href="mailto:devlee92736@gmail.com"
              className="hover:text-gray-900 underline"
            >
              Developer Email
            </a>
          </div>
          <div>
            <span>&copy; {new Date().getFullYear()} JH&apos;s SW Lab. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}