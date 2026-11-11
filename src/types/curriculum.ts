// src/types/curriculum.ts

export type MajorTrack = 'SINGLE' | 'DOUBLE' | 'MINOR';

export interface UserTrackConfig {
  primaryMajorName: string; // 기본값: '컴퓨터교육과'
  track: MajorTrack;         // 'SINGLE' | 'DOUBLE' | 'MINOR'
  secondaryMajorName: string; // 사용자가 입력한 제2전공명 (예: '기술·가정교육과', '수학교육과' 등)
}

export interface TrackRequirement {
  totalRequiredCredits: number;          // 총 졸업 요구 학점 (단일/부: 140, 복수: 144)
  generalEducationRequiredCredits: number; // 교양 요구 학점 (단일/부: 36, 복수: 18)
  balancedGeRequiredCredits: number;     // 균형교양 최소 학점 (단일/부: 12, 복수: 8)
  primaryRequiredCredits: number;        // 주전공 요구 학점 (단일: 72, 복수/부: 50~51)
  primaryDetails: {
    basic: number;        // 전공필수 (기본 7과목)
    coreAdvanced: number; // 전공선택 (최소전공 + 심화과정 합산)
  };
  secondaryRequiredCredits: number;      // 제2전공 요구 학점 (복수: 50, 부전공: 21, 단일: 0)
  primaryLabel: string;
  secondaryLabel: string;
  teachingTheoryRequired: number;        // 법정 교직과목 24학점 (이론 12 + 소양 8 + 실습 4)
  notes: string[];
}

/**
 * 공주대학교 사범대학 컴퓨터교육과 학생 기준 트랙별 졸업 이수 요구학점 산출
 */
export function getCollegeOfEducationRequirements(config: UserTrackConfig): TrackRequirement {
  const primaryName = config.primaryMajorName.trim() || '컴퓨터교육과';
  const secondaryName = config.secondaryMajorName.trim() || '제2전공';

  switch (config.track) {
    case 'DOUBLE':
      return {
        totalRequiredCredits: 144,
        generalEducationRequiredCredits: 18,
        balancedGeRequiredCredits: 8,
        primaryRequiredCredits: 50,
        primaryDetails: {
          basic: 21,
          coreAdvanced: 30,
        },
        secondaryRequiredCredits: 50,
        primaryLabel: `${primaryName} (주전공)`,
        secondaryLabel: `${secondaryName} (복수전공)`,
        teachingTheoryRequired: 24,
        notes: [
          '주전공(컴퓨터교육과) 전공필수 21학점(7과목) + 전공선택 30학점 이상 = 51학점 내외 이수',
          '복수전공 50학점 이상 (해당 표시과목 기본이수분야 및 교과교육 8학점 포함)',
          '교양 18학점 (균형교양 선택 8학점 이상 이수)',
          '법정 교직 24학점 (교직이론 12, 교직소양 8, 교육실습 4)',
          '학과 필수 졸업 요건: 캡스톤디자인Ⅱ 이수 필수'
        ],
      };

    case 'MINOR':
      return {
        totalRequiredCredits: 140,
        generalEducationRequiredCredits: 36,
        balancedGeRequiredCredits: 12,
        primaryRequiredCredits: 51,
        primaryDetails: {
          basic: 21,
          coreAdvanced: 30,
        },
        secondaryRequiredCredits: 21,
        primaryLabel: `${primaryName} (주전공)`,
        secondaryLabel: `${secondaryName} (부전공)`,
        teachingTheoryRequired: 24,
        notes: [
          '주전공(컴퓨터교육과) 전공필수 21학점 + 전공선택 30학점 이상',
          '부전공 과목 기본이수 15학점 이상을 포함하여 총 21학점 이상 이수',
          '교양 36학점 (균형교양 선택 12학점 이상, 3개 영역 이상 포함)',
          '법정 교직 24학점 (교직이론 12, 교직소양 8, 교육실습 4)',
          '학과 필수 졸업 요건: 캡스톤디자인Ⅱ 이수 필수'
        ],
      };

    case 'SINGLE':
    default:
      return {
        totalRequiredCredits: 140,
        generalEducationRequiredCredits: 36,
        balancedGeRequiredCredits: 12,
        primaryRequiredCredits: 72,
        primaryDetails: {
          basic: 21,
          coreAdvanced: 51,
        },
        secondaryRequiredCredits: 0,
        primaryLabel: `${primaryName} (단일전공)`,
        secondaryLabel: '',
        teachingTheoryRequired: 24,
        notes: [
          '컴퓨터교육과 단일전공: 전공필수 21학점(7과목) + 전공선택 51학점 이상 = 총 72학점 이상 필수',
          '교양 36학점 (균형교양 선택 12학점 이상, 3개 영역 이상 포함)',
          '법정 교직 24학점 (교직이론 12, 교직소양 8, 교육실습 4)',
          '학과 필수 졸업 요건: 캡스톤디자인Ⅱ 이수 필수',
          '총 졸업 이수 학점 140학점 이상'
        ],
      };
  }
}