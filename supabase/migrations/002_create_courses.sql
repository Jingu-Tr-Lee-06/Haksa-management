-- 1. courses 테이블 생성 (학과 정규 및 표준 커리큘럼 과목)
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_code VARCHAR(50),
    course_name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT '컴퓨터교육과',
    target_year INT NOT NULL CHECK (target_year BETWEEN 1 AND 5),
    target_semester VARCHAR(20) NOT NULL CHECK (target_semester IN ('1학기', '2학기', '하계학기', '동계학기', '전학기')),
    category VARCHAR(50) NOT NULL CHECK (
        category IN (
            '전공기초',
            '전공핵심',
            '전공심화',
            '기본이수',
            '교과교육',
            '기초교양필수',
            '기초교양선택',
            '균형교양',
            '일반선택',
            '교직이론',
            '교직소양',
            '교직실습'
        )
    ),
    credits NUMERIC(3, 1) NOT NULL DEFAULT 3.0,
    is_custom_created BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. seasonal_open_courses 테이블 생성 (사용자가 직접 세팅하는 계절학기 개설 과목 풀)
CREATE TABLE IF NOT EXISTS public.seasonal_open_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year INT NOT NULL,
    season VARCHAR(20) NOT NULL CHECK (season IN ('하계학기', '동계학기')),
    course_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    credits NUMERIC(3, 1) NOT NULL DEFAULT 3.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Row Level Security (RLS) 활성화
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_open_courses ENABLE ROW LEVEL SECURITY;

-- 4. courses RLS 정책 (공용 과목은 전체 조회 가능, 사용자 커스텀 등록 과목은 작성자만 수정/삭제)
DROP POLICY IF EXISTS "Public courses are viewable by all authenticated users" ON public.courses;
CREATE POLICY "Public courses are viewable by all authenticated users"
    ON public.courses FOR SELECT
    TO authenticated
    USING (is_custom_created = FALSE OR created_by = auth.uid());

DROP POLICY IF EXISTS "Users can insert custom courses" ON public.courses;
CREATE POLICY "Users can insert custom courses"
    ON public.courses FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update their own custom courses" ON public.courses;
CREATE POLICY "Users can update their own custom courses"
    ON public.courses FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own custom courses" ON public.courses;
CREATE POLICY "Users can delete their own custom courses"
    ON public.courses FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by);

-- 5. seasonal_open_courses RLS 정책 (자신이 등록한 계절학기 풀만 관리)
DROP POLICY IF EXISTS "Users can view their own seasonal open courses" ON public.seasonal_open_courses;
CREATE POLICY "Users can view their own seasonal open courses"
    ON public.seasonal_open_courses FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own seasonal open courses" ON public.seasonal_open_courses;
CREATE POLICY "Users can insert their own seasonal open courses"
    ON public.seasonal_open_courses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own seasonal open courses" ON public.seasonal_open_courses;
CREATE POLICY "Users can update their own seasonal open courses"
    ON public.seasonal_open_courses FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own seasonal open courses" ON public.seasonal_open_courses;
CREATE POLICY "Users can delete their own seasonal open courses"
    ON public.seasonal_open_courses FOR DELETE
    USING (auth.uid() = user_id);