# 공개 배포 준비 점검 — v1.0

점검일: 2026-10-17. 점검 범위는 현재 `LD_Concept_Mindmap_Lite` 프로젝트 폴더입니다. Git 이력 조회, 저장소 생성, 커밋, 원격 등록, 푸시, 실제 GitHub Pages 배포는 수행하지 않았습니다.

## 데이터·비밀정보 점검 결과

- 프로젝트의 숨김·ignore 대상까지 포함해 파일 목록을 확인했습니다. 의존성 `node_modules`와 생성물 `dist`는 소스 공개 목록에서 분리했고, dist는 별도로 산출물을 확인했습니다.
- 현재 공개 가능한 소스·설정·문서에 개인 컨셉 JSON, 사용자 session JSON, 환경 파일, 인증서·개인 키 파일을 발견하지 못했습니다.
- 키·토큰·비밀번호 리터럴, 개인 키 헤더, 이메일, 사용자 PC 절대 경로 패턴을 검색했으며 해당 패턴은 발견하지 못했습니다. 이는 현재 파일에 대한 정적 점검 결과이며 앞으로 추가되는 파일까지 보장하는 것은 아닙니다.
- **데이터 파일 1개가 공개됩니다:** `public/sample-generation.json`. 앞서 앱 테스트를 위해 만든 예제 `잊힌 도시의 탐험`, 일반 단어 75개입니다. 일반적인 시대·장르·동작·공간 단어이며 사용자 업로드 원본이 아닙니다. 내용을 변경하거나 삭제하지 않았습니다.
- 예제 SHA-256: `50a6f77beddd3eb4bb006486ea38f034760276c91fc1026e802b2c07cb782f69`.
- 원본 Antigravity JSON 및 SKILL.md는 탐색·수정 대상으로 추가하지 않았습니다.

## 예정 공개 파일

### public GitHub 저장소: 25개 파일

| 그룹 | 파일 |
| --- | --- |
| 문서 | `README.md`, `PUBLICATION_REVIEW.md` |
| 루트 설정 | `.gitignore`, `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts` |
| 자동 배포 | `.github/workflows/deploy.yml` |
| 빌드 전 공개 파일 점검 | `scripts/check-public.mjs` |
| UI·브라우저 처리 | `src/App.tsx`, `src/NodeCard.tsx`, `src/download.ts`, `src/exportPng.tsx`, `src/main.tsx`, `src/measureNode.ts`, `src/styles.css` |
| 데이터·배치 로직 | `src/domain/editing.ts`, `src/domain/exportGeometry.ts`, `src/domain/mindmap.ts`, `src/domain/session.ts` |
| 테스트 | `src/domain/editing.test.ts`, `src/domain/mindmap.test.ts`, `src/domain/session.test.ts` |
| 공개 예제 | `public/sample-generation.json` |

이 목록은 공개 준비 후보이며 아직 커밋하거나 푸시하지 않았습니다. `.gitignore`는 JSON을 기본 제외하고 필수 설정 JSON 3개와 예제 1개만 예외로 허용합니다. 이미 Git에 추적된 파일에는 ignore가 소급 적용되지 않으므로 향후 커밋 전 staged/추적 파일을 직접 확인해야 합니다.

### GitHub Pages 사이트: dist 산출물만

- `dist/index.html`
- `dist/assets/index-<hash>.js`
- `dist/assets/index-<hash>.css`
- `dist/sample-generation.json`

워크플로는 전체 저장소가 아닌 `dist`만 업로드합니다. `node_modules`, 사용자 session, 임시 파일, `.env`, 로컬 설정, 소스 테스트·문서·workflow는 웹사이트 산출물에 포함하지 않습니다. 단, public GitHub 저장소의 소스는 방문자가 별도로 열람할 수 있습니다.

Vite는 ignore와 상관없이 public의 파일을 복사하므로, prebuild 점검에서 허용된 예제 외 항목을 발견하면 빌드를 중단합니다. 삭제 동작은 없습니다. 새 파일을 공개하려면 내용을 검토하고 allowlist를 갱신해야 합니다. 예제 파일 내용 변경도 재검토 대상입니다.

## 사용자 JSON 처리 확인

- 가져오기는 `File.text()`와 로컬 JSON 파싱입니다. 편집 상태는 브라우저 메모리에만 있습니다.
- 세션 저장은 JSON Blob, PNG 저장은 별도 로컬 렌더링 후 Blob 다운로드입니다.
- 애플리케이션 코드에 JSON 업로드 API, 분석 도구, 외부 CDN·웹폰트를 추가하지 않았습니다.
- 로컬 프로덕션 서버의 `/LD_Concept_Mindmap_Lite/`에서 비공개 테스트 문자열을 포함한 JSON 불러오기 → 텍스트 수정 → 세션 저장·복원 → PNG 저장을 실행했습니다. 관찰된 HTTP 요청은 동일 출처의 HTML·JS·CSS GET뿐이며, 테스트 문자열 전송·POST·외부 출처 요청은 0건이었습니다. 다운로드는 정상이고 PNG 후 화면 위치·확대·선택도 유지됐습니다.
- Pages에 접속할 때 정적 파일을 받는 HTTP 요청은 발생합니다. 사용자 파일 내용이 호스팅 서버로 전송되지 않는다는 설명과 모든 네트워크가 없다는 설명은 다릅니다.

## 검증과 남은 외부 절차

- `npm run typecheck`: 통과.
- `npm test`: 기존 시각화·편집·세션·PNG 계산 관련 20개 통과.
- `npm run build`: public 허용 목록 검사와 프로덕션 빌드 통과.
- GitHub Pages 하위 경로를 적용한 **로컬 프로덕션 미리보기**: HTML·JS·CSS 로드, 예제 75개 다운로드, 편집·세션 복원·PNG 출력 통과.
- workflow는 공식 [Vite 배포 예제](https://vite.dev/guide/static-deploy.html#github-pages)와 [GitHub Pages 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)를 기준으로 작성하고 구조·권한·main 조건을 검토했습니다. **실제 GitHub Actions 실행 및 공개 사이트 검증은 아직 하지 않았습니다.**
- 공개 결정 후 사용자가 저장소를 생성하고 Settings → Pages의 Source를 GitHub Actions로 설정한 다음 main에 푸시해야 합니다. 최초 배포·업데이트 절차는 README에 있습니다.
