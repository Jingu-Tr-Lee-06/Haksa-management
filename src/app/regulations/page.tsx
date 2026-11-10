'use client';

import { useState, useEffect } from 'react';

interface CitationSource {
  title: string;
  article: string;
  content: string;
}

export default function RegulationsPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamAnswer, setStreamAnswer] = useState('');
  const [sources, setSources] = useState<CitationSource[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 사용자 개인 Gemini API 키 상태 (sessionStorage 기반)
  const [customKey, setCustomKey] = useState<string>('');
  const [inputKey, setInputKey] = useState<string>('');
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  // 컴포넌트 마운트 시 세션스토리지에서 기존 키 복원
  useEffect(() => {
    const saved = sessionStorage.getItem('knu_gemini_custom_key');
    if (saved) {
      setCustomKey(saved);
      setInputKey(saved);
    }
  }, []);

  const handleSaveCustomKey = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputKey.trim();
    if (trimmed) {
      sessionStorage.setItem('knu_gemini_custom_key', trimmed);
      setCustomKey(trimmed);
      setIsKeyModalOpen(false);
      setErrorMessage(null);
    }
  };

  const handleRemoveCustomKey = () => {
    sessionStorage.removeItem('knu_gemini_custom_key');
    setCustomKey('');
    setInputKey('');
    setIsKeyModalOpen(false);
  };

  const predefinedQuestions = [
    '조기졸업을 위한 평점 기준과 신청 자격은 어떻게 되나요?',
    '수강신청 잔여 학점 이월 규정(최대 학점 및 대상)은 무엇인가요?',
    '사범대학 복수전공자의 기본이수과목 및 교과교육영역 이수 기준은?',
    '교원자격 무시험검정의 비교과(성인지, 응급처치, 인적성) 요건은?',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);
    setStreamAnswer('');
    setSources([]);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (customKey) {
        headers['x-gemini-api-key'] = customKey;
      }

      const response = await fetch('/api/regulations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: query.trim() }),
      });

      // 할당량 초과(429) 또는 오류 응답 처리
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 429 || errData.error === 'QUOTA_EXCEEDED') {
          // 키가 등록되어 있지 않은 경우 모달 자동 오픈
          if (!customKey) {
            setIsKeyModalOpen(true);
          }
          throw new Error('QUOTA_EXCEEDED: 현재 서버의 AI 토큰 일일 무료 제공량이 모두 소진되었습니다.');
        }
        throw new Error(errData.error || errData.message || '규정 질의 처리 실패');
      }

      if (!response.body) {
        throw new Error('스트리밍 응답 바디가 비어 있습니다.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const ev of events) {
          if (!ev.trim()) continue;

          const lines = ev.split('\n');
          let eventType = 'message';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.replace('event: ', '').trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.replace('data: ', '').trim();
            }
          }

          if (eventType === 'meta') {
            try {
              const meta = JSON.parse(dataStr);
              if (meta.sources) {
                setSources(meta.sources);
              }
            } catch (err) {
              console.error('메타데이터 파싱 실패:', err);
            }
          } else if (eventType === 'message') {
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                setStreamAnswer((prev) => prev + parsed.text);
              }
            } catch (err) {
              console.error('청크 파싱 실패:', err);
            }
          } else if (eventType === 'error') {
            try {
              const errObj = JSON.parse(dataStr);
              setErrorMessage(errObj.error || '스트리밍 도중 오류가 발생했습니다.');
            } catch {
              setErrorMessage(dataStr);
            }
          } else if (eventType === 'done') {
            break;
          }
        }
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : '학사 규정 질의 처리 중 오류가 발생하였습니다.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePredefinedClick = (q: string) => {
    setQuery(q);
  };

  const isQuotaExceeded =
    errorMessage &&
    (errorMessage.includes('QUOTA_EXCEEDED') ||
      errorMessage.includes('할당량') ||
      errorMessage.includes('429'));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* 상단 헤더 및 API 키 설정 버튼 */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            ACADEMIC REGULATIONS RAG
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            국립공주대학교 학사 규정 및 예규 AI 질의응답
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            학칙, 학사 규정집, 교원양성 및 교원자격 무시험검정 예규를 기반으로 실시간 스트리밍 답변을 도출합니다.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setIsKeyModalOpen(true)}
            className={`rounded border px-3 py-1.5 text-xs font-semibold transition ${
              customKey
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {customKey ? '개인 API 키 적용 중' : '개인 API 키 등록'}
          </button>
        </div>
      </div>

      {/* 주요 질의 템플릿 칩 */}
      <div className="mt-6">
        <p className="text-[11px] font-semibold text-slate-600">주요 질의 템플릿</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {predefinedQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handlePredefinedClick(q)}
              className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 transition hover:border-slate-300 hover:bg-white"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* 질의 입력 폼 */}
      <form onSubmit={handleSubmit} className="mt-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            required
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="궁금한 학사 규정, 졸업 기준, 이수 요건 등을 입력하십시오."
            className="flex-1 rounded border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:border-slate-800"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="rounded bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
          >
            {isLoading ? '규정 분석 중...' : '규정 검색'}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          기본 서버의 AI 무료 토큰 제공량이 소진된 경우 상단의 [개인 API 키 등록]을 통해 본인 키를 사용하실 수 있습니다.
        </p>
      </form>

      {/* 할당량 소진 전용 안내 카드 또는 일반 에러 박스 */}
      {isQuotaExceeded ? (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50/70 p-5 text-xs text-amber-950">
          <div className="flex items-center justify-between border-b border-amber-200 pb-2">
            <span className="font-bold text-amber-900">
              AI 토큰 일일 무료 제공량 소진 안내
            </span>
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="rounded bg-amber-900 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-amber-800"
            >
              개인 API 키 바로 등록하기
            </button>
          </div>
          <p className="mt-3 leading-relaxed text-amber-900">
            사범대 비영리 학사 지원 시스템으로 운영되어 기본 API 일일 무료 호출량이 모두 소진되었습니다.
            Google AI Studio에서 무료로 발급받은 개인 Gemini API 키를 등록하시면 제한 없이 즉시 사용하실 수 있습니다. (서버/DB에 저장되지 않으며 브라우저 탭에만 안전하게 유지됩니다.)
          </p>
          <div className="mt-3 rounded border border-amber-200 bg-white p-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">운영 주체:</span>
              <span className="font-semibold text-slate-800">JH&apos;s SW Lab (Dev_Lee06)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">후원 및 개발 문의:</span>
              <a
                href="mailto:devlee92736@gmail.com"
                className="font-semibold text-blue-600 underline"
              >
                devlee92736@gmail.com
              </a>
            </div>
          </div>
        </div>
      ) : errorMessage ? (
        <div className="mt-6 rounded border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {/* 실시간 스트리밍 분석 결과 카드 */}
      {(streamAnswer || isLoading) && (
        <div className="mt-8 space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">규정 해석 및 검토 결과</h2>
              {isLoading && (
                <span className="text-[11px] font-semibold text-blue-600 animate-pulse">
                  실시간 답변 스트리밍 중...
                </span>
              )}
            </div>

            <div className="mt-4 whitespace-pre-wrap text-xs leading-relaxed text-slate-800 font-sans">
              {streamAnswer}
              {isLoading && (
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-slate-900 animate-pulse align-middle" />
              )}
            </div>
          </div>

          {/* 참조 조항 및 근거 자료 카드 */}
          {sources.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-xs font-bold text-slate-900">
                참조 조항 및 근거 자료 ({sources.length}건)
              </h3>
              <div className="mt-3 space-y-3">
                {sources.map((source, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-slate-200 bg-white p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        {source.title}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        {source.article}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-600 leading-normal">
                      {source.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 개인 Gemini API 키 등록 모달 (세션 임시 보관, DB 미저장) */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">개인 Gemini API 키 설정</h3>
              <button
                type="button"
                onClick={() => setIsKeyModalOpen(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                닫기
              </button>
            </div>

            <div className="mt-3 rounded border border-blue-200 bg-blue-50/60 p-3 text-[11px] text-blue-900 leading-relaxed">
              <p className="font-bold">보안 및 개인정보 보호 원칙</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-blue-800">
                <li>입력하신 API 키는 <strong>서버 DB나 영구 저장소에 일절 저장되지 않습니다.</strong></li>
                <li>오직 현재 브라우저 탭 세션(`sessionStorage`)에만 보관되며, <strong>탭을 닫으면 즉시 영구 삭제</strong>됩니다.</li>
                <li>무료 API 키는 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="font-semibold underline">Google AI Studio</a>에서 바로 발급받을 수 있습니다.</li>
              </ul>
            </div>

            <form onSubmit={handleSaveCustomKey} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">
                  Gemini API Key (AIzaSy...)
                </label>
                <input
                  type="password"
                  required
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="Google AI Studio에서 발급받은 API 키를 입력하세요"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-xs outline-none focus:border-slate-800 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {customKey ? (
                  <button
                    type="button"
                    onClick={handleRemoveCustomKey}
                    className="text-xs text-red-600 hover:text-red-800 underline"
                  >
                    등록된 키 삭제
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsKeyModalOpen(false)}
                    className="rounded border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="rounded bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    세션에 적용
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}