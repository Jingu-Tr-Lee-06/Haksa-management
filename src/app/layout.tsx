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
              <Link
                href="/profile"
                className="rounded-md px-2.5 py-1.5 transition hover:bg-slate-100 hover:text-slate-900"
              >
                계정 관리
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
                  href="https://com-study.notion.site/KNU-Academic-Advisor-41529cd9f9d8803b8d36f6ab84ebde65?source=copy_link"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-slate-800"
                >
                  서비스 설명
                </a>
                <span className="text-slate-300">|</span>
                <a
                  href="https://com-study.notion.site/KNU-Academic-Advisor-41529cd9f9d880c5b9caf70960b1d9f2?source=copy_link"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-slate-800"
                >
                  개인정보처리방침
                </a>
                <span className="text-slate-300">|</span>
                <a
                  href="https://com-study.notion.site/KNU-Academic-Advisor-41529cd9f9d8802481cbd1009b23313c?source=copy_link"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-slate-800"
                >
                  서비스 이용약관
                </a>
                <span className="text-slate-300">|</span>

                {/* 순수 CSS 기반 팝업 모달 제어 (별도 파일 분리 없음) */}
                <input
                  type="checkbox"
                  id="thanks-modal-trigger"
                  className="peer hidden"
                />

                {/* 열기 트리거 */}
                <label
                  htmlFor="thanks-modal-trigger"
                  className="cursor-pointer transition hover:text-slate-900 font-medium select-none"
                >
                  도움을 주신 분들
                </label>

                {/* 팝업 모달 영역 (peer-checked 시 활성화) */}
                <div className="fixed inset-0 z-50 hidden peer-checked:flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
                  {/* 바깥 배경 클릭 시 닫히는 오버레이 */}
                  <label
                    htmlFor="thanks-modal-trigger"
                    className="absolute inset-0 cursor-default"
                  />

                  {/* 모달 창 */}
                  <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-left z-10">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          SPECIAL THANKS & CONTRIBUTORS
                        </span>
                        <h3 className="text-base font-bold text-slate-900">
                          도움을 주신 분들
                        </h3>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3.5 text-xs text-slate-600">
                      <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                        <p className="font-bold text-slate-800 text-[13px]">국립공주대학교 컴퓨터교육과</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">컴퓨터교육과 25학번</p>
                      </div>

                      <div className="space-y-1.5 pl-1">
                        <div className="flex items-center justify-between py-1 border-b border-slate-50">
                          <span className="font-semibold text-slate-800">베타 테스터</span> 
                          <span className="text-[11px] text-slate-500">김규민 || 김리안 || 전진아 || 조예인 || 하정민</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="font-semibold text-slate-800">기획 및 총괄 개발</span>
                          <span className="font-bold text-slate-900">JH&apos;s SW Lab (이진호)</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed pt-2">
                        국립공주대학교 예비교원의 엄밀하고 안전한 학사·졸업 사정을 위해 함께 검증해주신 모든 분들께 감사드립니다.
                      </p>
                    </div>

                    <div className="mt-5 flex justify-end pt-2 border-t border-slate-100">
                      {/* 정상 작동하는 확인(닫기) 버튼 */}
                      <label
                        htmlFor="thanks-modal-trigger"
                        className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 cursor-pointer select-none"
                      >
                        확인
                      </label>
                    </div>
                  </div>
                </div>

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