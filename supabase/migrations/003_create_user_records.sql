-- 1. user_completed_courses 테이블 생성 (사용자별 기이수 과목 및 성적)
CREATE TABLE IF NOT EXISTS public.user_completed_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_name VARCHAR(100) NOT NULL,
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
    grade VARCHAR(5) NOT NULL CHECK (
        grade IN ('A+', 'A0', 'B+', 'B0', 'C+', 'C0', 'D+', 'D0', 'F', 'P', 'S', 'U')
    ),
    grade_point NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    taken_year INT NOT NULL,
    taken_semester VARCHAR(20) NOT NULL CHECK (
        taken_semester IN ('1학기', '2학기', '하계학기', '동계학기')
    ),
    is_major_course BOOLEAN NOT NULL DEFAULT FALSE,
    is_teaching_course BOOLEAN NOT NULL DEFAULT FALSE,
    is_retaken BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. user_non_subject_records 테이블 생성 (사범대 무시험검정 비교과 요건 관리)
CREATE TABLE IF NOT EXISTS public.user_non_subject_records (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    gender_equity_education_count INT NOT NULL DEFAULT 0 CHECK (gender_equity_education_count BETWEEN 0 AND 4),
    teaching_aptitude_test_count INT NOT NULL DEFAULT 0 CHECK (teaching_aptitude_test_count BETWEEN 0 AND 2),
    cpr_training_count INT NOT NULL DEFAULT 0 CHECK (cpr_training_count BETWEEN 0 AND 2),
    volunteer_hours NUMERIC(5, 1) NOT NULL DEFAULT 0.0,
    narcotics_test_submitted BOOLEAN NOT NULL DEFAULT FALSE,
    korean_history_certified BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Row Level Security (RLS) 활성화
ALTER TABLE public.user_completed_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_non_subject_records ENABLE ROW LEVEL SECURITY;

-- 4. user_completed_courses RLS 정책
DROP POLICY IF EXISTS "Users can view their own completed courses" ON public.user_completed_courses;
CREATE POLICY "Users can view their own completed courses"
    ON public.user_completed_courses FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own completed courses" ON public.user_completed_courses;
CREATE POLICY "Users can insert their own completed courses"
    ON public.user_completed_courses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own completed courses" ON public.user_completed_courses;
CREATE POLICY "Users can update their own completed courses"
    ON public.user_completed_courses FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own completed courses" ON public.user_completed_courses;
CREATE POLICY "Users can delete their own completed courses"
    ON public.user_completed_courses FOR DELETE
    USING (auth.uid() = user_id);

-- 5. user_non_subject_records RLS 정책
DROP POLICY IF EXISTS "Users can view their own non subject records" ON public.user_non_subject_records;
CREATE POLICY "Users can view their own non subject records"
    ON public.user_non_subject_records FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own non subject records" ON public.user_non_subject_records;
CREATE POLICY "Users can insert their own non subject records"
    ON public.user_non_subject_records FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own non subject records" ON public.user_non_subject_records;
CREATE POLICY "Users can update their own non subject records"
    ON public.user_non_subject_records FOR UPDATE
    USING (auth.uid() = user_id);

-- 6. 신규 회원가입 시 user_non_subject_records 레코드 자동 초기화 트리거 함수 보강
CREATE OR REPLACE FUNCTION public.handle_new_user_non_subject()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_non_subject_records (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_non_subject ON auth.users;
CREATE TRIGGER on_auth_user_created_non_subject
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_non_subject();