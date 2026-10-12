# 멍수박 · 가나디 버전

기존 멍수박은 그대로 두고 최종 stage8을 가나디로 바꾼 별도 버전입니다.

- 최종 이미지: 제공된 최종 가나디.jpg의 투명 배경 처리본
- 원본 보존: assets/originals/final-ganadi.jpg
- 바뀐 파일: assets/images/stage8.png, src/data/stages.js, index.html
- 물리·합체·점수·콤보·사운드 로직은 기존과 동일합니다.
- 설치: npm install
- 실행: npm run dev
- 빌드: npm run build
- 검증: 기존 단위 테스트 20개 통과, 최종 진화·중복 점수/사운드 방지·재시작 브라우저 검사 통과
- 실제 iPhone Safari 기기 검사는 수행하지 않았습니다.
