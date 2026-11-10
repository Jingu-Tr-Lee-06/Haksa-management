'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';

interface OfferedUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OfferedUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: OfferedUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [semester, setSemester] = useState<string>('1학기');
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
      setErrorMsg('개설강좌 엑셀 파일을 첨부해 주십시오.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      });

      if (rawRows.length < 3) {
        throw new Error('엑셀 파일에 유효한 강좌 데이터가 없습니다.');
      }

      // 0행 헤더에서 컬럼 인덱스 매핑
      const headers = rawRows[0].map((h: any) => String(h).trim());
      const colIdx = {
        code: headers.indexOf('교과목코드'),
        name: headers.indexOf('교과목명'),
        section: headers.indexOf('반'),
        grade: headers.indexOf('학년'),
        category: headers.indexOf('이수구분'),
        currCategory: headers.indexOf('교육과정구분'),
        credit: headers.indexOf('학점'),
        theory: headers.indexOf('이론'),
        practice: headers.indexOf('실습'),
        time: headers.indexOf('요일/교시'),
        room: headers.indexOf('강의실'),
        campus: headers.indexOf('개설 캠퍼스'),
        limit: headers.indexOf('인\xa0원'), // 0행 인원
        dept: headers.indexOf('개설학과'),
        managingDept: headers.indexOf('주관학과'),
        college: headers.indexOf('주관학과소속'),
        remarks: headers.indexOf('수강참고사항'),
        profName: headers.indexOf('교수명'),
        profCode: headers.indexOf('교번'),
        isRemote: headers.indexOf('원격 강의'),
        isForeign: headers.indexOf('원어 강의'),
      };

      if (colIdx.code === -1 || colIdx.name === -1) {
        throw new Error('국립공주대학교 개설강좌조회 표준 엑셀 양식이 아닙니다.');
      }

      const courseMap = new Map<string, any>();

      // 2행부터 데이터 파싱
      for (let i = 2; i < rawRows.length; i++) {
        const row = rawRows[i];
        const courseCode = String(row[colIdx.code] || '').trim();
        const courseName = String(row[colIdx.name] || '').trim();
        if (!courseCode || !courseName) continue;

        const classSection = String(row[colIdx.section] || '01').trim();
        const professorName = String(row[colIdx.profName] || '담당교수').trim() || '담당교수';
        const key = `${year}-${semester}-${courseCode}-${classSection}-${professorName}`;

        const credits = parseFloat(String(row[colIdx.credit] || '3').trim()) || 3.0;
        const theoryHours = parseInt(String(row[colIdx.theory] || '3').trim(), 10) || 0;
        const practiceHours = parseInt(String(row[colIdx.practice] || '0').trim(), 10) || 0;
        const capacityLimit = parseInt(String(row[colIdx.limit] || '0').trim(), 10) || null;

        courseMap.set(key, {
          year,
          semester,
          course_code: courseCode,
          course_name: courseName,
          class_section: classSection,
          target_grade: String(row[colIdx.grade] || '').trim() || null,
          category: String(row[colIdx.category] || '전선').trim(),
          curriculum_category: String(row[colIdx.currCategory] || '').trim() || null,
          credits,
          theory_hours: theoryHours,
          practice_hours: practiceHours,
          timetable: String(row[colIdx.time] || '').trim() || null,
          classroom: String(row[colIdx.room] || '').trim() || null,
          campus: String(row[colIdx.campus] || '신관').trim(),
          capacity_limit: capacityLimit,
          department: String(row[colIdx.dept] || '').trim() || null,
          managing_department: String(row[colIdx.managingDept] || '').trim() || null,
          college: String(row[colIdx.college] || '사범대학').trim(),
          professor_name: professorName,
          professor_code: String(row[colIdx.profCode] || '').trim() || null,
          remarks: String(row[colIdx.remarks] || '').trim() || null,
          is_remote: String(row[colIdx.isRemote] || 'N').trim() === 'Y',
          is_foreign_language: String(row[colIdx.isForeign] || 'N').trim() === 'Y',
          updated_at: new Date().toISOString(),
        });
      }

      const rowsToInsert = Array.from(courseMap.values());
      if (rowsToInsert.length === 0) {
        throw new Error('유효한 개설강좌 데이터가 0건입니다.');
      }

      // Supabase ON CONFLICT UPSERT 실행 (복합 고유키 기준)
      const { error: upsertError } = await (supabase.from('offered_courses') as any).upsert(
        rowsToInsert,
        {
          onConflict: 'year,semester,course_code,class_section,professor_name',
        }
      );

      if (upsertError) throw upsertError;

      alert(`정상 반영: 총 ${rowsToInsert.length}개 개설강좌가 공유 DB에 등록(동기화)되었습니다.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('개설강좌 업로드 에러:', err);
      setErrorMsg(err.message || '파일 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900">
            공용 개설강좌 엑셀 등록
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
            국립공주대학교 개설강좌 엑셀 다운로드 경로
          </p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-slate-600 leading-relaxed">
            <li>통합정보시스템(포털) 로그인 &gt; <strong>수업/수강</strong> &gt; <strong>개설강좌조회</strong></li>
            <li>조회하고자 하는 학년도 및 학기 선택 후 <strong>[조회]</strong> 클릭</li>
            <li>우측 상단 <strong>[엑셀]</strong> 다운로드 버튼을 눌러 파일 저장</li>
            <li>동일 강좌가 이미 등록되어 있다면 최신 정보로 자동 갱신됩니다.</li>
          </ol>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">개설년도</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">개설학기</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-800"
            >
              <option value="1학기">1학기</option>
              <option value="2학기">2학기</option>
              <option value="하계학기">하계학기</option>
              <option value="동계학기">동계학기</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-700">
            개설강좌 엑셀 파일(.xlsx)
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
            {isProcessing ? '중복 검증 및 동기화 중...' : '개설강좌 공용 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}