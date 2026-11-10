import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full border-t border-slate-200 bg-white py-8 text-xs text-slate-500">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <div className="flex flex-col items-center sm:items-start gap-1">
          <p className="font-semibold text-slate-700">
            JH's SW Lab
          </p>
          <p>
            국립공주대학교 컴퓨터교육과 졸업 사정 및 학사 시뮬레이션 시스템
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6">
          <Link
            href="https://notion.so"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-900 transition-colors"
          >
            서비스 설명
          </Link>
          <Link
            href="https://notion.so"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-900 transition-colors"
          >
            이용약관
          </Link>
          <Link
            href="https://notion.so"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-900 transition-colors"
          >
            개인정보처리방침
          </Link>
          <a
            href="mailto:devlee92736@gmail.com"
            className="hover:text-slate-900 transition-colors"
          >
            Developer: devlee92736@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}