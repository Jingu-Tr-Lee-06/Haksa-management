-- 1. semester_plans 테이블 생성 (학기별 수강 계획 마스터)
CREATE TABLE IF NOT EXISTS public.semester_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_year INT NOT NULL,
    target_semester VARCHAR(20) NOT NULL CHECK (
        target_semester IN ('1학기', '2학기', '하계학기', '동계학기')
    ),
    max_credits_limit NUMERIC(3, 1) NOT NULL DEFAULT 18.0,
    carried_over_credits NUMERIC(3, 1) NOT NULL DEFAULT 0.0 CHECK (carried_over_credits BETWEEN 0.0 AND 3.0),
    is_early_graduation_target BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_semester_plan UNIQUE (user_id, target_year, target_semester)
);

-- 2. planned_courses 테이블 생성 (학기별 수강 계획 내 개별 과목)
CREATE TABLE IF NOT EXISTS public.planned_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.semester_plans(id) ON DELETE CASCADE,
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
    is_seasonal_course BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Row Level Security (RLS) 활성화
ALTER TABLE public.semester_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_courses ENABLE ROW LEVEL SECURITY;

-- 4. semester_plans RLS 정책
DROP POLICY IF EXISTS "Users can view their own semester plans" ON public.semester_plans;
CREATE POLICY "Users can view their own semester plans"
    ON public.semester_plans FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own semester plans" ON public.semester_plans;
CREATE POLICY "Users can insert their own semester plans"
    ON public.semester_plans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own semester plans" ON public.semester_plans;
CREATE POLICY "Users can update their own semester plans"
    ON public.semester_plans FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own semester plans" ON public.semester_plans;
CREATE POLICY "Users can delete their own semester plans"
    ON public.semester_plans FOR DELETE
    USING (auth.uid() = user_id);

-- 5. planned_courses RLS 정책 (부모 semester_plans의 소유권 기반 제어)
DROP POLICY IF EXISTS "Users can view their own planned courses" ON public.planned_courses;
CREATE POLICY "Users can view their own planned courses"
    ON public.planned_courses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.semester_plans sp
            WHERE sp.id = planned_courses.plan_id
            AND sp.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert their own planned courses" ON public.planned_courses;
CREATE POLICY "Users can insert their own planned courses"
    ON public.planned_courses FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.semester_plans sp
            WHERE sp.id = planned_courses.plan_id
            AND sp.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own planned courses" ON public.planned_courses;
CREATE POLICY "Users can update their own planned courses"
    ON public.planned_courses FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.semester_plans sp
            WHERE sp.id = planned_courses.plan_id
            AND sp.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete their own planned courses" ON public.planned_courses;
CREATE POLICY "Users can delete their own planned courses"
    ON public.planned_courses FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.semester_plans sp
            WHERE sp.id = planned_courses.plan_id
            AND sp.user_id = auth.uid()
        )
    );