# Level Concept Mindmap Lite v1.0

브라우저에서 동작하는 generation JSON 마인드맵 뷰어·편집기. 파일 내용은 브라우저에서만 처리하며 서버로 전송하지 않습니다.

## 실행

Node.js 20.19+ 또는 22.12+ 환경에서:

```sh
npm install
npm run dev
```

터미널에 표시되는 `/LD_Concept_Mindmap_Lite/` 경로의 로컬 주소를 엽니다. `npm run typecheck`, `npm test`, `npm run build`로 검증합니다.

## 업로드 테스트

1. 시작 화면의 **샘플 JSON 다운로드**를 누르거나 `public/sample-generation.json`을 사용합니다.
2. **JSON 불러오기**에서 파일을 선택합니다.
3. 중심 컨셉, 고정 축 5개, 단어 75개와 연결선을 확인합니다.
4. 드래그로 이동, 휠 및 좌측 하단 버튼으로 확대·축소, **전체 보기**로 초기 구도를 복원합니다.
5. 잘못된 버전, 중복 ID, 없는 부모 등을 넣은 파일로 오류 안내를 확인합니다. 실패해도 기존 맵은 유지됩니다.

## 2단계 편집 확인

- 중심·일반 노드 더블클릭: 내부 텍스트 편집. Enter 확정, Esc 취소. 한국어 IME 조합 중 Enter는 확정 키로 처리하지 않습니다.
- 일반 노드: 공백 제거·유니코드 NFC 정규화 후 1~15자, 모든 축의 일반 노드 사이 중복 금지. 글자 수는 결합 문자·이모지를 한 글자 단위로 셉니다. 기존 JSON의 단어는 그대로 불러오며 수정·추가할 때 검증합니다.
- 중심 문장: 길이 제한 없음, 빈 문장 금지. 축 이름은 고정됩니다.
- 축·일반 노드를 클릭한 뒤 **＋ 하위 노드 추가**: 축·부모·깊이가 자동 계산됩니다. 깊이는 3 이후도 계속 추가할 수 있습니다. 새 노드는 입력 대기 상태이며 유효한 텍스트를 확정하면 실제 데이터에 추가됩니다. Esc로 취소하면 미완성 노드는 사라집니다.
- 일반 노드 선택 → **노드 삭제** → 확인: 선택한 노드와 모든 자손만 삭제됩니다. 중심·축은 삭제 불가입니다.
- 편집 중에는 캔버스 이동·줌·선택 단축키를 막고, Enter/Esc 입력을 노드 편집에 사용합니다.
- 수정·추가·삭제 후 자동 재배치하며 확대·화면 위치를 유지합니다. 새 노드가 완전히 화면 밖에 생기는 경우에만 확대 비율을 유지한 채 화면을 이동합니다. 전체 보기는 수동으로 누를 수 있습니다.
- 16자 이상, 공백만 입력, 다른 축의 기존 단어 입력을 거부하는지 확인하세요. 추가 노드를 4~5단계까지 연결하고 부모를 삭제해 자손만 사라지는지 확인하세요.

편집은 현재 페이지 메모리에서 유지됩니다. 계속 작업하려면 상단 **세션 저장**으로 직접 다운로드하세요. 자동 저장·Undo/Redo는 포함하지 않습니다. 원본 파일을 수정하지 않습니다.

## 3단계 저장·복원·출력

- **세션 저장**: `{concept-slug}_session.json` 다운로드. 편집 중이면 Enter로 확정하거나 Esc로 취소한 뒤 저장합니다.
- **JSON 불러오기**: generation은 기존 자동 배치·전체 보기, session은 저장된 좌표·확대·화면 위치를 그대로 복원합니다. 세션 복원 직후 자동 전체 보기를 실행하지 않습니다.
- **PNG 저장**: `{concept-slug}_mindmap.png` 다운로드. 전체 맵을 2배 해상도·투명 배경·사방 64px(출력 시 128px) 여백으로 내보냅니다. 화면 밖 노드도 포함하며 툴바·격자·조작 버튼·선택 테두리는 제외합니다. 별도 렌더링 영역을 사용하므로 기존 화면 상태를 변경하지 않습니다.
- 출력 한도: 한 변 16,384px, 총 6,400만 픽셀. 한도를 넘거나 브라우저가 생성에 실패하면 오류를 표시합니다. 임의로 축소하거나 자르지 않습니다. 브라우저·메모리에 따라 실제 한도는 더 작을 수 있습니다.

세션 형식은 `type: "session"`, `schemaVersion: "1.0"`, `concept`, `nodes` 외에 다음 필드를 저장합니다.

```json
{
  "positions": [
    { "id": "concept", "x": -140, "y": -48 },
    { "id": "axis-era", "x": -110, "y": -200 }
  ],
  "viewport": { "x": 800, "y": 400, "zoom": 0.75 }
}
```

위는 필드 예시입니다. 실제 positions에는 중심·5축·일반 노드 **모두** 포함되어야 합니다. nodes는 일반 노드만 저장하며 개수·깊이 제한은 없습니다. viewport.zoom은 앱에서 지원하는 0.01~2.5입니다. 중복 ID·없는 부모·다른 축 부모·부모와 맞지 않는 깊이·누락/잘못된 좌표·잘못된 화면 값을 거부합니다. 기존 generation에서 허용하던 긴 단어 등은 세션에서도 보존합니다. 잘못된 JSON을 열면 현재 작업을 유지합니다.

### 수동 검증 순서

1. 기존 generation JSON 또는 `public/sample-generation.json`을 불러옵니다.
2. 단어 수정·노드 추가·부모 삭제 후 화면을 이동·확대하고 **세션 저장**합니다.
3. 다른 JSON을 연 뒤 저장한 session을 불러옵니다. 컨셉·텍스트·남은 노드·연결과 화면 위치·확대가 같은지 확인합니다.
4. 세션의 parentId를 없는 ID로 변경하거나 positions 항목 하나를 삭제한 복사본을 불러옵니다. 오류가 나타나고 기존 작업이 유지되는지 확인합니다.
5. 일부 노드가 화면 밖으로 나가도록 확대한 상태에서 **PNG 저장**합니다. 이미지 편집기의 투명 배경(체크무늬) 위에서 전체 노드·연결선·텍스트와 바깥 여백을 확인합니다. 불투명한 미리보기 배경만으로 투명도를 판단하지 않습니다.
6. PNG에는 격자·툴바·조작 버튼·선택 표시가 없고, 저장 후 앱의 화면 위치·확대·선택이 그대로인지 확인합니다.

## 입력 계약

```json
{
  "type": "generation",
  "schemaVersion": "1.0",
  "concept": "잊힌 도시의 탐험",
  "nodes": [
    { "id": "era-1", "parentId": "axis-era", "axis": "era", "depth": 1, "text": "고대" },
    { "id": "era-2", "parentId": "era-1", "axis": "era", "depth": 2, "text": "유적" }
  ]
}
```

위 코드는 필드 예시이며 실제 nodes는 정확히 75개여야 합니다. 완전한 예시는 public의 샘플입니다.

- concept: 비어 있지 않은 문자열.
- axis: era / genre / action / space / element.
- 최상위 단어: depth 1, parentId는 해당 고정 축 ID(axis-era / axis-genre / axis-action / axis-space / axis-element).
- 하위 단어(depth 2~3): parentId는 같은 축의 단어 ID, depth는 부모 depth + 1.
- ID는 고유 문자열이며 concept 및 5개 고정 축 ID는 예약됩니다.
- 배열 순서는 자유이며 형제의 표시 순서는 입력 순서를 따릅니다. 추가 필드는 무시합니다.
- generation 파일 제한 5MB(편집 후 session 파일에는 적용하지 않음). 긴 텍스트는 자동 줄바꿈하고 카드 높이를 확장해 전체 표시합니다.

## 구조와 범위

- `src/domain/mindmap.ts`: 입력 검증 및 독립적인 그래프·좌표 생성.
- `src/App.tsx`: 파일 로딩, 편집 상태, 선택·작업 버튼, 캔버스.
- `src/NodeCard.tsx`: 사용자 정의 노드와 내부 텍스트 편집 UI.
- `src/domain/editing.ts`: 순수 함수 기반 수정·추가·자손 삭제 및 텍스트 검증.
- `src/domain/editing.test.ts`: 입력 거부, 깊이·축 상속, 연결 보존, 자손 삭제 테스트.
- `src/styles.css`: 화면과 축 색상 스타일.
- `src/domain/mindmap.test.ts`: 부모 연결, 입력 오류 및 카드 겹침 검증.
- `src/domain/session.ts`: 세션 검증·생성·좌표 복원·파일명.
- `src/domain/session.test.ts`: 세션 왕복, 무효 입력, PNG 범위·출력 한도 검증.
- `src/exportPng.tsx`: 독립 React Flow 렌더링과 투명 PNG 출력.
- `src/domain/exportGeometry.ts`: 전체 노드 경계·2배 해상도·출력 한도 계산.

리프 수에 비례해 5개 축의 방사형 영역을 배분합니다. 일반 노드는 폭 200px·본문 17px, 축은 폭 220px·본문 18px이며 긴 텍스트는 높이가 늘어납니다. 브라우저에서 측정한 카드 크기와 16px 간격을 기준으로 각 노드를 방사선 위의 가장 가까운 빈 위치에 배치합니다. 한 구역의 충돌 때문에 전체 맵을 확대하지 않습니다. 극단적으로 편중된 트리는 전체 보기에서 작게 보일 수 있어 확대해서 읽습니다. 3단계는 기존 편집 기능과 수동 세션 저장·복원, 투명 PNG 출력을 제공합니다. JSON 가져오기 계약은 기존 75개·깊이 1~3 generation 형식을 유지하고, 가져온 뒤의 편집 모델은 노드 수와 깊이에 제한을 두지 않습니다. 수동 위치 편집·백엔드·DB·AI API·자동 저장·다중 프로젝트는 포함하지 않습니다.


## GitHub Pages 공개 배포 준비

현재는 로컬 설정만 준비한 상태입니다. 저장소 생성·커밋·원격 등록·푸시·실제 배포는 실행하지 않았습니다.

- 저장소 이름: `LD_Concept_Mindmap_Lite`
- 예정 주소: `https://<GitHub 사용자명>.github.io/LD_Concept_Mindmap_Lite/`
- Vite base: `/LD_Concept_Mindmap_Lite/`. 샘플 다운로드도 `import.meta.env.BASE_URL`을 사용합니다.
- `.github/workflows/deploy.yml`: main 푸시 또는 main에서의 수동 실행 → Node.js 24 + `npm ci` → 타입 검사 → 테스트 → public 파일 점검 및 빌드 → `dist`만 Pages에 배포합니다.
- 빌드·배포 job을 분리하고 배포 job에만 Pages 쓰기·OIDC 권한을 부여합니다. Actions는 공식 배포 예제에서 확인한 커밋 SHA로 고정했습니다. 별도 API 키나 개인 액세스 토큰을 소스에 넣지 않습니다.

공식 안내: [Vite의 GitHub Pages 경로와 워크플로](https://vite.dev/guide/static-deploy.html#github-pages), [GitHub Pages 사용자 지정 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). GitHub Free에서 무료 Pages를 사용하려면 public 저장소를 사용합니다.

### 배포 승인 후 최초 공개 방법

아래는 이후 사용자가 공개를 결정한 뒤 실행할 안내이며, 이번 준비 작업에서는 실행하지 않았습니다.

1. GitHub에 이름이 정확히 `LD_Concept_Mindmap_Lite`인 빈 public 저장소를 생성합니다.
2. 공개 파일 목록과 `PUBLICATION_REVIEW.md`를 확인합니다. 특히 public 폴더에는 예제 외에 개인 데이터가 없어야 합니다.
3. 로컬 검증을 실행합니다.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run preview
```

미리보기 주소는 `http://127.0.0.1:4173/LD_Concept_Mindmap_Lite/`입니다. 화면, 샘플 다운로드, 본인 JSON의 편집·세션 왕복·PNG 출력을 확인합니다.

4. 프로젝트가 아직 Git 저장소가 아니라면 초기화하고 아래 공개 파일만 명시적으로 추가합니다. 기존 저장소라면 초기화는 생략합니다. 실제 GitHub 사용자명으로 `<GitHub 사용자명>`을 바꿉니다.

```sh
git init -b main
git add .github/workflows/deploy.yml .gitignore README.md PUBLICATION_REVIEW.md index.html package.json package-lock.json tsconfig.json vite.config.ts src scripts/check-public.mjs public/sample-generation.json
git diff --cached --stat
git diff --cached
```

파일 내용을 검토한 후에만 커밋·푸시합니다.

```sh
git commit -m "Prepare Level Concept Mindmap Lite v1.0 for GitHub Pages"
git remote add origin https://github.com/<GitHub 사용자명>/LD_Concept_Mindmap_Lite.git
git push -u origin main
```

5. 저장소 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택합니다. Actions 실행 권한도 활성화되어 있어야 합니다. 첫 workflow가 Pages 설정 전에 실행되어 실패했다면 설정 후 Actions에서 다시 실행합니다.
6. Actions의 **Deploy GitHub Pages**가 성공한 뒤 Pages에 표시되는 실제 사이트 주소로 접속합니다. 이 절차는 별도 gh-pages 브랜치나 dist의 직접 커밋이 필요하지 않습니다.

### 업데이트 방법

수정 후 타입 검사·테스트·빌드·미리보기를 반복합니다. 공개할 변경 파일만 `git add <파일 경로>`로 추가하고, staged 내용을 확인한 뒤 커밋하여 `git push origin main`하면 같은 workflow로 다시 배포됩니다. 저장소 이름이나 커스텀 도메인을 바꾸는 경우에는 Vite base도 해당 주소에 맞게 바꿔야 합니다.

### 공개 파일과 사용자 데이터 분리

- 사이트에 배포되는 것은 `dist/index.html`, `dist/assets/*.js`, `dist/assets/*.css`, `dist/sample-generation.json`입니다. 소스·테스트·README·workflow는 public GitHub 저장소에서 별도로 열람 가능합니다.
- 유일하게 공개하는 데이터는 앞서 만든 데모 **잊힌 도시의 탐험**(`public/sample-generation.json`, 일반 단어 75개)입니다. 개인 Antigravity 원본이나 사용자 session은 포함하지 않습니다.
- `.gitignore`는 JSON을 기본 제외하며 package·lock·tsconfig와 위 데모만 예외로 허용합니다. 새 공개 JSON fixture/config를 추가하려면 내용을 검토한 뒤 명시적으로 예외를 추가해야 합니다.
- `node_modules`, `dist`, 임시 파일·로그·환경 파일·키 파일·로컬 도구 설정·사용자 데이터 폴더·다운로드 PNG도 제외합니다.
- **public 안의 파일은 Git ignore 여부와 무관하게 Vite 빌드에 복사됩니다.** `scripts/check-public.mjs`를 prebuild로 실행하여 현재 허용된 데모 외 파일·폴더·심볼릭 링크가 있으면 빌드를 중단합니다. 파일은 삭제하지 않습니다. 새 정적 자산을 추가할 때에는 검토 후 allowlist를 갱신하세요. 기존 데모 내용을 바꾸는 경우에도 공개 적합성을 다시 검토해야 합니다.
- `.gitignore`는 이미 Git에 등록된 파일을 제거하지 않습니다. 향후 기존 저장소에 적용한다면 staged/추적 파일을 별도로 점검해야 합니다. 개인 데이터는 `private/`, `sessions/` 등에서 보관하고 src/public 안에는 두지 마세요.

### 브라우저 내 처리와 네트워크

사용자가 선택한 JSON은 `File.text()`로 읽고 브라우저 메모리에서 검증·편집합니다. 세션과 PNG는 Blob 다운로드이며 파일 내용을 전송하는 API·분석 도구·외부 폰트/CDN을 추가하지 않았습니다. Pages는 정적 앱·CSS·JS·예제 파일을 내려주는 호스팅입니다. 페이지 접속·정적 파일 다운로드의 HTTP 요청은 발생하지만, 사용자가 불러온 컨셉·세션 내용은 그 요청에 첨부하지 않습니다.

공개 사이트에서도 브라우저 개발자 도구 Network에서 Preserve log를 켜고 JSON 불러오기·편집·세션 저장·PNG 저장을 실행해 사용자 JSON 내용이 포함된 요청이나 POST 업로드가 없는지 확인할 수 있습니다. 저장하지 않은 편집은 브라우저 새로고침 시 사라지므로 수동 세션 저장을 사용합니다.
