import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'KNU Academic Advisor - 통합 학사 및 졸업사정 시스템',
  description:
    '국립공주대학교 사범대학 컴퓨터교육과 학생을 위한 학사 규정 질의, 성적 판독 및 졸업사정 자동화 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased"
        suppressHydrationWarning
      >
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-slate-900 sm:text-base text-sm">
                  KNU Academic Advisor
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                  사범대학
                </span>
              </Link>
            </div>
            <nav className="flex items-center gap-1 sm:gap-4 text-xs font-medium text-slate-600">
              <Link
                href="/audit"
                className="rounded-md px-2.5 py-1.5 transition hover:bg-slate-100 hover:text-slate-900"
              >
                졸업 사정
              </Link>
              <Link
                href="/curriculum"
                className="rounded-md px-2.5 py-1.5 transition hover:bg-slate-100 hover:text-slate-900"
              >
                성적 관리
              </Link>
              <Link
                href="/simulator"
                className="rounded-md px-2.5 py-1.5 transition hover:bg-slate-100 hover:text-slate-900"
              >
                수강 시뮬레이터
              </Link>
              <Link
                href="/regulations"
                className="rounded-md px-2.5 py-1.5 transition hover:bg-slate-100 hover:text-slate-900"
              >
                규정 질의(RAG)
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex flex-col items-center gap-1 sm:items-start">
                <p className="font-semibold text-slate-700">JH&apos;s SW Lab</p>
                <p className="text-[11px] text-slate-400">
                  국립공주대학교 사범대학 컴퓨터교육과 학사 가이드 시스템
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]">
                <a
                  href="https://notion.so"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-slate-800"
                >
                  서비스 설명
                </a>
                <span className="text-slate-300">|</span>
                <a
                  href="https://notion.so"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-slate-800"
                >
                  개인정보처리방침
                </a>
                <span className="text-slate-300">|</span>
                <a
                  href="https://notion.so"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-slate-800"
                >
                  서비스 이용약관
                </a>
                <span className="text-slate-300">|</span>
                <a
                  href="mailto:devlee92736@gmail.com"
                  className="transition hover:text-slate-800"
                >
                  문의: devlee92736@gmail.com
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}