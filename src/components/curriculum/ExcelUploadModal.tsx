'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';

interface ExcelUploadModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ExcelUploadModal({
  userId,
  isOpen,
  onClose,
  onSuccess,
}: ExcelUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const supabase = createClient();

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const handleUploadAndParse = async () => {
    if (!file) {
      setErrorMsg('엑셀 파일을 선택해 주십시오.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      });

      if (rawRows.length < 2) {
        throw new Error('엑셀 파일에 유효한 성적 데이터가 없습니다.');
      }

      const headerIdx = rawRows.findIndex(
        (row) => row.includes('과목명') || row.includes('과목코드')
      );

      if (headerIdx === -1) {
        throw new Error('국립공주대 누적성적조회 표준 엑셀 양식이 아닙니다.');
      }

      const headers = rawRows[headerIdx].map((h: any) => String(h).trim());
      const colIdx = {
        year: headers.indexOf('년도'),
        semester: headers.indexOf('학기'),
        category: headers.indexOf('이수구분'),
        code: headers.indexOf('과목코드'),
        name: headers.indexOf('과목명'),
        credit: headers.indexOf('학점'),
        grade: headers.indexOf('등급'),
        point: headers.indexOf('평점'),
      };

      if (colIdx.name === -1 || colIdx.credit === -1 || colIdx.grade === -1) {
        throw new Error('필수 열(과목명, 학점, 등급)을 찾을 수 없습니다.');
      }

      let currentYear = 2025;
      let currentSemester = '1학기';
      let currentCategory = '전선';

      const parsedCourses = [];

      for (let i = headerIdx + 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        const courseName = String(row[colIdx.name] || '').trim();
        if (!courseName) continue;

        if (colIdx.year !== -1 && String(row[colIdx.year]).trim()) {
          const y = parseInt(String(row[colIdx.year]).trim(), 10);
          if (!isNaN(y)) currentYear = y;
        }

        if (colIdx.semester !== -1 && String(row[colIdx.semester]).trim()) {
          const s = String(row[colIdx.semester]).trim();
          currentSemester = s.includes('학기') ? s : `${s}학기`;
        }

        if (colIdx.category !== -1 && String(row[colIdx.category]).trim()) {
          currentCategory = String(row[colIdx.category]).trim();
        }

        const credits = parseFloat(String(row[colIdx.credit] || '0').trim()) || 0;
        const grade = String(row[colIdx.grade] || 'P').trim().toUpperCase();
        const gradePoint = parseFloat(String(row[colIdx.point] || '0').trim()) || 0.0;
        const courseCode = colIdx.code !== -1 ? String(row[colIdx.code] || '').trim() : '';

        // 이수구분 정밀 판별
        const isMajor =
          currentCategory.includes('전공') ||
          currentCategory.includes('전선') ||
          currentCategory.includes('전필') ||
          currentCategory.includes('전기') ||
          currentCategory.includes('복수');

        const isTeaching =
          currentCategory.includes('교직') ||
          currentCategory.includes('일반교육학') ||
          courseName.includes('교육론') ||
          courseName.includes('교재연구');

        parsedCourses.push({
          user_id: userId,
          course_code: courseCode || null,
          course_name: courseName,
          category: currentCategory,
          credits,
          grade,
          grade_point: gradePoint,
          taken_year: currentYear,
          taken_semester: currentSemester,
          is_major_course: isMajor,
          is_teaching_course: isTeaching,
          is_retaken: false,
        });
      }

      if (parsedCourses.length === 0) {
        throw new Error('추출된 수강 이수 과목이 0건입니다.');
      }

      const { error: insertError } = await (
        supabase.from('user_completed_courses') as any
      ).insert(parsedCourses);

      if (insertError) throw insertError;

      alert(`정상 처리: 총 ${parsedCourses.length}개 이수 교과목이 등록되었습니다.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('엑셀 파싱/업로드 오류:', err);
      setErrorMsg(err.message || '엑셀 파일을 처리하는 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900">
            포털 누적성적 엑셀 일괄 업로드
          </h2>
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-400 hover:text-slate-700"
          >
            닫기
          </button>
        </div>

        <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3.5 text-xs">
          <p className="font-bold text-slate-800">
            국립공주대학교 포털 성적 파일 다운로드 절차
          </p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-slate-600 leading-relaxed">
            <li>통합정보시스템(포털)에 로그인합니다.</li>
            <li>
              좌측 메뉴에서 <strong>성적</strong> &gt; <strong>누적성적조회(학부생)</strong>로 이동합니다.
            </li>
            <li>
              우측 상단의 <strong>[엑셀]</strong> 다운로드 버튼을 클릭하여 파일을 저장합니다.
            </li>
            <li>다운로드된 엑셀 파일(.xlsx)을 아래에 등록하십시오.</li>
          </ol>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-700">
            다운로드한 엑셀 파일 첨부
          </label>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="mt-1.5 block w-full rounded border border-slate-300 p-2 text-xs text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-800"
          />
          {file && (
            <p className="mt-1.5 text-[11px] text-slate-600">
              선택 파일: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!file || isProcessing}
            onClick={handleUploadAndParse}
            className="rounded bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
          >
            {isProcessing ? '데이터 추출 및 등록 중...' : '엑셀 일괄 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}