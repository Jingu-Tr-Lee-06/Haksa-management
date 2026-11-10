-- 1. profiles 테이블 생성 (Supabase auth.users 연동 및 CHECK 제약 조건 적용)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    student_number VARCHAR(20),
    name VARCHAR(50),
    primary_major VARCHAR(100) NOT NULL DEFAULT '컴퓨터교육과',
    double_major VARCHAR(100),
    track VARCHAR(20) NOT NULL DEFAULT 'SINGLE_MAJOR' CHECK (track IN ('SINGLE_MAJOR', 'DOUBLE_MAJOR')),
    admission_year INT NOT NULL DEFAULT 2025,
    target_graduation_semester VARCHAR(20) NOT NULL DEFAULT '8학기',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Row Level Security (RLS) 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS 정책 정의 (본인 프로필만 조회/수정/삽입 가능)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 4. 신규 회원가입 시 public.profiles 자동 생성 트리거 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, student_number, name)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'student_number', ''),
        COALESCE(new.raw_user_meta_data->>'name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. auth.users 테이블 생성 이벤트 트리거 바인딩
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();