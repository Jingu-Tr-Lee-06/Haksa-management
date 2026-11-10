import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { RegulationChunk } from '../src/types/regulation';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

interface TargetPdfConfig {
  sourceDoc: '규정집' | '예규집';
  fileName: string;
  defaultRegulationName: string;
}

const TARGET_FILES: TargetPdfConfig[] = [
  {
    sourceDoc: '규정집',
    fileName: '규정집.pdf',
    defaultRegulationName: '국립공주대학교 학사운영규정',
  },
  {
    sourceDoc: '예규집',
    fileName: '예규집.pdf',
    defaultRegulationName: '교원양성 및 교원자격검정 시행세칙',
  },
];

/**
 * 텍스트 내용에서 검색 인덱싱용 핵심 키워드를 추출한다.
 */
function extractKeywords(text: string): string[] {
  const candidateKeywords = [
    '수강신청', '취득학점', '신청학점', '학점이월', '이월',
    '계절학기', '계절수업', '하계학기', '동계학기',
    '조기졸업', '수업연한', '평점평균', '졸업요건', '학위수여',
    '기본이수과목', '교과교육영역', '교과교육론', '교재연구', '논리논술',
    '복수전공', '사범계열', '전공학점', '교직과목', '무시험검정',
    '교직인적성', '응급처치', '심폐소생술', '성인지', '성인지교육',
    '교육봉사', '마약검사', '한국사', '컴퓨터교육과',
  ];

  return candidateKeywords.filter((kw) => text.includes(kw));
}

/**
 * 추출된 전체 텍스트를 조항 단위('제O조')로 정규식 분절하여 정형 청크 배열을 생성한다.
 */
function chunkTextByArticles(
  rawText: string,
  sourceDoc: '규정집' | '예규집',
  defaultRegulationName: string
): RegulationChunk[] {
  const chunks: RegulationChunk[] = [];
  
  // '제O조(조항제목)' 형태의 패턴 매칭
  const articleRegex = /(제\s*\d+\s*조(?:\s*\([^)]+\))?)([\s\S]*?)(?=(?:제\s*\d+\s*조(?:\s*\([^)]+\))?)|$)/g;

  let match: RegExpExecArray | null;
  let chunkIndex = 1;

  while ((match = articleRegex.exec(rawText)) !== null) {
    const fullHeader = match[1].trim();
    const rawContent = match[2].trim();

    if (rawContent.length < 20) {
      continue;
    }

    // 조항 번호와 조항 제목 분리: 예) "제63조 (수강신청 및 학점)"
    const headerParts = fullHeader.match(/(제\s*\d+\s*조)\s*(?:\(([^)]+)\))?/);
    const articleNumber = headerParts ? headerParts[1].replace(/\s+/g, '') : fullHeader;
    const articleTitle = headerParts && headerParts[2] ? headerParts[2].trim() : '학사 규정 조항';

    // 연속된 공백 및 줄바꿈 정제
    const cleanedContent = rawContent.replace(/\s+/g, ' ');

    const keywords = extractKeywords(`${articleTitle} ${cleanedContent}`);

    // 학사/졸업/교직과 관련된 핵심 키워드가 1개 이상 포함된 조항만 선별 적재
    if (keywords.length > 0) {
      chunks.push({
        id: `${sourceDoc === '규정집' ? 'reg' : 'rule'}-${String(chunkIndex).padStart(3, '0')}`,
        sourceDoc,
        regulationName: defaultRegulationName,
        articleNumber,
        articleTitle,
        pageNumber: 1,
        content: `${fullHeader} ${cleanedContent}`,
        keywords,
      });
      chunkIndex++;
    }
  }

  return chunks;
}

async function main() {
  const rawDocsDir = path.join(process.cwd(), 'data', 'raw-docs');
  const outputFilePath = path.join(process.cwd(), 'public', 'data', 'regulations.json');

  if (!fs.existsSync(rawDocsDir)) {
    console.error(`디렉터리가 존재하지 않습니다: ${rawDocsDir}`);
    process.exit(1);
  }

  const allChunks: RegulationChunk[] = [];

  for (const target of TARGET_FILES) {
    const targetPath = path.join(rawDocsDir, target.fileName);

    if (!fs.existsSync(targetPath)) {
      console.warn(`경고: 파일을 찾을 수 없어 건너뜁니다 -> ${targetPath}`);
      continue;
    }

    console.log(`PDF 파싱 시작: ${target.fileName} ...`);
    const dataBuffer = fs.readFileSync(targetPath);
    
    // pdf-parse@1.1.1 함수 직접 호출
    const pdfData = await pdf(dataBuffer);

    const generatedChunks = chunkTextByArticles(
      pdfData.text,
      target.sourceDoc,
      target.defaultRegulationName
    );

    console.log(`- ${target.fileName}: 관련 조항 ${generatedChunks.length}건 추출 완료`);
    allChunks.push(...generatedChunks);
  }

  if (allChunks.length === 0) {
    console.warn('추출된 조항 데이터가 없습니다. 파일명 또는 조항 양식을 확인하십시오.');
    return;
  }

  const outputDir = path.dirname(outputFilePath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFilePath, JSON.stringify(allChunks, null, 2), 'utf-8');
  console.log(`총 ${allChunks.length}개 규정 청크가 성공적으로 생성되었습니다: ${outputFilePath}`);
}

main().catch((err) => {
  console.error('규정집 파싱 처리 중 오류 발생:', err);
  process.exit(1);
});