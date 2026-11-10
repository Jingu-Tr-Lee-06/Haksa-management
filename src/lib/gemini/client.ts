import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인하십시오.');
}

export const genAI = new GoogleGenerativeAI(apiKey);