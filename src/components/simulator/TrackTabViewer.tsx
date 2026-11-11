// src/components/simulator/TrackTabViewer.tsx
'use client';

import React from 'react';
import { MajorTrack, getCollegeOfEducationRequirements } from '@/types/curriculum';

export interface UserAcademicProfile {
  primaryMajor: string;         // '컴퓨터교육과'
  majorTrack: MajorTrack;       // 'SINGLE' | 'DOUBLE' | 'MINOR'
  secondaryMajor: string | null; // 예: '기술·가정교육과', '수학교육과'
}

export interface CreditStatus {
  primaryEarned: number;        // 주전공 취득 학점
  secondaryEarned: number;      // 제2전공 취득 학점
  teachingEarned: number;       // 교직 취득 학점
  totalEarned: number;          // 총 이수 학점
}

interface TrackTabViewerProps {
  profile: UserAcademicProfile;
  creditStatus: CreditStatus;
  activeTab: string;
  onSelectTab: (tabKey: string) => void;
}

export default function TrackTabViewer({
  profile,
  creditStatus,
  activeTab,
  onSelectTab,
}: TrackTabViewerProps) {
  const req = getCollegeOfEducationRequirements({
    primaryMajorName: profile.primaryMajor || '컴퓨터교육과',
    track: profile.majorTrack,
    secondaryMajorName: profile.secondaryMajor || '',
  });

  // 탭 목록 동적 구성
  const tabs = [
    { key: 'primary', label: req.primaryLabel },
    ...(profile.majorTrack !== 'SINGLE'
      ? [{ key: 'secondary', label: req.secondaryLabel }]
      : []),
    { key: 'teaching', label: '교직과정 (사범대 필수)' },
    { key: 'general', label: '교양 및 기타' },
  ];

  // 달성률 계산 헬퍼
  const calcRate = (earned: number, required: number) => {
    if (required <= 0) return 100;
    return Math.min(100, Math.round((earned / required) * 100));
  };

  const primaryRate = calcRate(creditStatus.primaryEarned, req.primaryRequiredCredits);
  const secondaryRate = calcRate(creditStatus.secondaryEarned, req.secondaryRequiredCredits);
  const teachingRate = calcRate(creditStatus.teachingEarned, req.teachingTheoryRequired);

  return (
    <div className="w-full bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-5">
      {/* 1. 상단 트랙 배지 및 안내 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-gray-900 text-white">
              {profile.majorTrack === 'SINGLE' && '단일전공 트랙'}
              {profile.majorTrack === 'DOUBLE' && '복수전공 트랙'}
              {profile.majorTrack === 'MINOR' && '부전공 트랙'}
            </span>
            <h3 className="text-base font-bold text-gray-900">
              {profile.primaryMajor || '컴퓨터교육과'}
              {profile.majorTrack !== 'SINGLE' && profile.secondaryMajor && ` / ${profile.secondaryMajor}`}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            공주대학교 사범대학 교육과정 및 교원자격검정 기준에 따른 실시간 이수 사정
          </p>
        </div>

        {/* 총 이수 학점 / 동적 졸업 기준 (단일/부: 140, 복수: 144) */}
        <div className="text-right">
          <span className="text-xs text-gray-500">총 취득 학점 / 졸업 기준</span>
          <p className="text-lg font-bold text-gray-900">
            {creditStatus.totalEarned}{' '}
            <span className="text-sm font-normal text-gray-400">
              / {req.totalRequiredCredits} 학점
            </span>
          </p>
        </div>
      </div>

      {/* 2. 트랙별 학점 달성 프로그레스 바 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 주전공 카드 */}
        <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-gray-700">{req.primaryLabel}</span>
            <span className="text-gray-900 font-bold">
              {creditStatus.primaryEarned} / {req.primaryRequiredCredits}학점 ({primaryRate}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gray-900 h-2 rounded-full transition-all duration-300"
              style={{ width: `${primaryRate}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500">
            전공필수 21학점(7과목), 교과교육 8학점, 캡스톤Ⅱ 포함
          </p>
        </div>

        {/* 제2전공 카드 (복수/부전공 시에만 렌더링) */}
        {profile.majorTrack !== 'SINGLE' && (
          <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-gray-700">{req.secondaryLabel}</span>
              <span className="text-gray-900 font-bold">
                {creditStatus.secondaryEarned} / {req.secondaryRequiredCredits}학점 ({secondaryRate}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gray-900 h-2 rounded-full transition-all duration-300"
                style={{ width: `${secondaryRate}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-500">
              {profile.majorTrack === 'DOUBLE'
                ? '기본이수 21학점, 교과교육 8학점 포함 (50학점 이상)'
                : '부전공 21학점 이상 (기본이수 15학점 이상 포함)'}
            </p>
          </div>
        )}

        {/* 법정 교직 24학점 카드 */}
        <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-gray-700">교직과정 (이론/소양/실습)</span>
            <span className="text-gray-900 font-bold">
              {creditStatus.teachingEarned} / {req.teachingTheoryRequired}학점 ({teachingRate}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gray-900 h-2 rounded-full transition-all duration-300"
              style={{ width: `${teachingRate}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500">
            교직이론 12, 교직소양 8, 교육실습 4학점
          </p>
        </div>
      </div>

      {/* 3. 탭 네비게이션 헤더 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-2 -mb-px" aria-label="Tabs">
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onSelectTab(tab.key)}
                className={`py-2.5 px-4 text-xs font-semibold rounded-t-md transition-colors border-b-2 ${
                  isSelected
                    ? 'border-gray-900 text-gray-900 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 4. 사정 규정 지침 안내 박스 */}
      <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 space-y-1">
        <span className="font-semibold text-gray-900">사범대 사정 유의사항:</span>
        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-600">
          {req.notes.map((note, idx) => (
            <li key={idx}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}