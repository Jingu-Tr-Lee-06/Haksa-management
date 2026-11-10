# parse_regulations.py
import os
import re
import json
from bs4 import BeautifulSoup

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(BASE_DIR, 'data', 'raw')
OUTPUT_PATH = os.path.join(BASE_DIR, 'public', 'data', 'regulations.json')

def clean_text(text: str) -> str:
    text = text.replace('\xa0', ' ').replace('&nbsp;', ' ')
    text = re.sub(r'[ \t]+', ' ', text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return '\n'.join(lines)

def extract_keywords(title: str, content: str) -> list:
    targets = [
        '복수전공', '부전공', '교과교육', '기본이수', '교직', '이월', '조기졸업',
        '수강신청', '캡스톤', '졸업', '학점', '교양', '성인지', '응급처치',
        '인적성', '재입학', '편입학', '휴학', '복학', '전과', '성적', '유예',
        '사범대학', '컴퓨터', '무시험검정', '자격증', '수업'
    ]
    combined = title + ' ' + content
    return [kw for kw in targets if kw in combined]

# 학생 학사 상담에 필수적인 규정 및 예규 화이트리스트 키워드
TARGET_REGULATION_KEYWORDS = [
    '학칙', '학사운영', '교육과정', '교원양성', '교직', '무시험검정', '복수전공',
    '학점이월', '장학', '수업운영', '학위취득', '조기졸업', '성적', '전과', '재입학'
]

def is_academic_target(text: str) -> bool:
    return any(k in text for k in TARGET_REGULATION_KEYWORDS)

def parse_html_regulations():
    chunks = []
    chunk_id = 1

    # 1. 규정집.html 파싱
    gyujeong_path = os.path.join(RAW_DIR, '규정집.html')
    if os.path.exists(gyujeong_path):
        print("[1/2] 규정집.html 학사 핵심 조항 선별 파싱...")
        with open(gyujeong_path, 'r', encoding='utf-8', errors='ignore') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')

        # 목차/색인 영역 제외 및 본문 텍스트 추출
        full_doc_lines = []
        for line_div in soup.find_all('div', class_='hls'):
            t = clean_text(line_div.get_text())
            # 점선 목차(……… 123) 제외
            if t and not re.search(r'[\.ㆍ…]{4,}\s*\d+', t):
                full_doc_lines.append(t)
        
        full_text = '\n'.join(full_doc_lines)
        articles = re.split(r'\n(?=제\s*\d+\s*조(?:\s*의\s*\d+)?\s*\([^)]+\))', full_text)

        current_reg_title = "국립공주대학교 학칙 및 학사운영규정"

        for art in articles:
            art_clean = clean_text(art)
            if len(art_clean) < 30:
                continue

            # 조항 매칭
            match = re.match(r'^(제\s*\d+\s*조(?:\s*의\s*\d+)?)\s*\(([^)]+)\)', art_clean)
            if match:
                art_num = match.group(1).replace(' ', '')
                art_name = match.group(2).strip()
                art_title = f"{art_num}({art_name})"
                
                # 학사 관련 키워드가 포함된 유의미한 조항만 선별
                if is_academic_target(art_title) or is_academic_target(art_clean[:200]):
                    chunks.append({
                        "id": f"reg_{chunk_id}",
                        "sourceDoc": "국립공주대학교 규정집",
                        "regulationName": current_reg_title,
                        "articleNumber": art_num,
                        "articleTitle": art_title,
                        "pageNumber": 1,
                        "content": art_clean[:2000],  # 과도하게 긴 조항 자르기
                        "keywords": extract_keywords(art_title, art_clean)
                    })
                    chunk_id += 1

    # 2. 예규집.html 파싱
    yegyu_path = os.path.join(RAW_DIR, '예규집.html')
    if os.path.exists(yegyu_path):
        print("[2/2] 예규집.html 학사/교직 지침 선별 파싱...")
        with open(yegyu_path, 'r', encoding='utf-8', errors='ignore') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')

        full_doc_lines = []
        for line_div in soup.find_all('div', class_='hls'):
            t = clean_text(line_div.get_text())
            if t and not re.search(r'[\.ㆍ…]{4,}\s*\d+', t):
                full_doc_lines.append(t)

        full_text = '\n'.join(full_doc_lines)
        guidelines = re.split(r'\n(?=(?:국립)?공주대학교\s+[^\n]{2,35}(?:지침|세칙|규정|수칙|규약))', full_text)

        for g in guidelines:
            g_clean = clean_text(g)
            if len(g_clean) < 80:
                continue

            first_line = g_clean.splitlines()[0]
            title_match = re.search(r'((?:국립)?공주대학교\s+[^\n]+?(?:지침|세칙|규정|수칙|규약))', first_line)
            g_title = title_match.group(1).strip() if title_match else first_line[:40]

            # 학사, 학생, 교원양성, 수업 관련 지침만 필터링
            if is_academic_target(g_title) or is_academic_target(g_clean[:300]):
                step = 1200
                for i in range(0, len(g_clean), step):
                    part_content = g_clean[i:i + step]
                    chunks.append({
                        "id": f"yegyu_{chunk_id}",
                        "sourceDoc": "국립공주대학교 예규집",
                        "regulationName": g_title,
                        "articleNumber": "지침조항",
                        "articleTitle": f"{g_title} (Part {i//step + 1})",
                        "pageNumber": 1,
                        "content": part_content,
                        "keywords": extract_keywords(g_title, part_content)
                    })
                    chunk_id += 1

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)

    print(f"\n최종 완료: 학사 핵심 청크 총 {len(chunks)}개가 생성되었습니다. ({OUTPUT_PATH})")

if __name__ == '__main__':
    parse_html_regulations()