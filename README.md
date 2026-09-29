# 소율한의원 · 순음청력검사 보조 / 개인별 음향자극음 생성

진료실에서 의료진이 쓰는 브라우저 프로그램입니다. 서버 없이 PC의 브라우저 안에서만 동작하며, 환자 기록과 음원은 외부로 전송되지 않습니다.

**바로 사용:** https://dws1019.github.io/soyul-audiometry/ (GitHub Pages — 정적 파일만 제공하며, 검사 기록은 접속한 각 PC의 브라우저에만 저장됩니다)

```
환자 선택/등록 → 순음청력검사 안내 → 주파수별 검사음 → 좌우 결과 기록 → Audiogram
→ 취약 주파수 표시(검사 결과 참고) → 의료진이 2개 주파수 선택 → 두 순음 합성 → 미리듣기 → WAV/MP3 다운로드
```

> 본 프로그램의 음 발생 기능은 검사 보조 목적으로 설계되었습니다. 정확한 임상 청력역치(dB HL)를 측정하려면 교정된 청력검사 장비와 헤드폰이 필요합니다.

---

## 1. 프로젝트 구조

```
soyul-audiometry/
├─ index.html
├─ package.json · vite.config.ts · tsconfig*.json
├─ public/favicon.svg                   소율 심볼
└─ src/
   ├─ main.tsx · App.tsx                 화면 조립, 워크플로 상태, 안전 규칙
   ├─ config/constants.ts                검사 주파수·안전 한계·레벨 눈금·기본값·고지 문구 (한 곳에서 관리)
   ├─ types/
   │  ├─ audiometry.ts                   귀·역치·순위·간이검사 상태
   │  ├─ patient.ts                      환자(ID·날짜·메모)·검사 세션
   │  ├─ stimulus.ts                     자극음 설정·합성 명세(좌우 채널별 성분)·프리셋
   │  └─ calibration.ts                  측정 모드·장비별 교정표
   ├─ utils/                             (UI와 분리된 로직)
   │  ├─ audioEngine.ts                  실시간 음 발생 (Web Audio): 단일 Voice 수명 관리·램프·채널 라우팅·긴급 정지
   │  ├─ stimulusSynth.ts                두 순음 합성·정규화·리미터·페이드 (순수 계산, Worker와 공유)
   │  ├─ stimulusGenerator.ts            generateMixedAudio(): Worker로 파일 생성·진행률·취소
   │  ├─ wavEncoder.ts                   WAV(PCM 16-bit, TPDF 디더) · exportWav()
   │  ├─ levels.ts                       % ↔ 진폭, 교정표 기반 dB HL ↔ dBFS (확장 지점)
   │  ├─ hearingAnalysis.ts              취약 주파수 순위·강조·4분법 평균·간이 검사 단계
   │  ├─ frequencyValidation.ts          Custom 주파수 범위·나이퀴스트 검증
   │  ├─ storage.ts · sessionSchema.ts   LocalStorage 저장, 읽은 데이터 검증
   │  ├─ exporters.ts                    JSON/CSV 내보내기·가져오기, 다운로드
   │  ├─ audiogramImage.ts               Audiogram SVG → PNG
   │  └─ format.ts · id.ts               표기·파일명·ID
   ├─ workers/stimulus.worker.ts         긴 음원을 1초 단위로 합성·인코딩 (화면 멈춤 없음)
   ├─ hooks/                             usePlayback · useSession(자동 보관) · useKeyboardShortcuts
   ├─ components/
   │  ├─ AppHeader · SafetyStopButton · PlaybackStatus
   │  ├─ PatientInfo · PatientEducation
   │  ├─ FrequencyPanel · EarSelector · ToneController · LevelSlider · SimpleTestMode
   │  ├─ Audiogram · HearingResultTable · VulnerableFrequencyPanel
   │  ├─ SoundTherapyGenerator · FrequencyPicker · AudioPreview · ExportPanel
   │  ├─ SessionHistory · CalibrationDialog · PrintReport · Modal · Toast · ErrorBoundary · EarMarker
   ├─ styles/tokens.css · app.css · print.css   소율한의원 디자인 시스템 토큰(홈페이지와 동일)
   └─ assets/                            로고(가로형 컴팩트·심볼), NanumSquare·Pretendard 글꼴
```

요구된 Audio Engine 함수와 위치:

| 함수 | 위치 |
| --- | --- |
| `playTone(frequency, gain, channel)` | `audioEngine.playTone` |
| `stopTone()` | `audioEngine.stopTone` |
| `playTimedTone(frequency, duration, gain, channel)` | `audioEngine.playTimedTone` |
| `previewMixedTone(freqA, freqB, gainA, gainB)` | `audioEngine.previewMixedTone` (화면은 파일과 같은 명세를 쓰는 `previewStimulus` 사용) |
| `generateMixedAudio(settings)` | `utils/stimulusGenerator.ts` (audioEngine에서도 다시 내보냄) |
| `exportWav(audioBuffer)` | `utils/wavEncoder.ts` (audioEngine에서도 다시 내보냄) |

## 2. 핵심 UX

- **한 페이지, 5단계.** 상단 고정 헤더의 `① 환자 ② 검사 ③ 취약 주파수 ④ 자극음 ⑤ 기록`으로 바로 이동합니다.
- **검사 화면(데스크톱 3단):** 왼쪽 6개 큰 주파수 버튼(버튼마다 L/R 기록값 표시) · 가운데 상태/귀/레벨/제시/들림·안 들림 · 오른쪽 Audiogram과 결과표. 1440×900과 1366×768 노트북에서 상태 → 귀 → 레벨 → 제시 → 반응 버튼이 스크롤 없이 한 화면에 들어오도록 조정했습니다. 1280px 미만(태블릿 가로)은 2단(결과는 아래), 900px 이하는 1단입니다.
- **재생 상태를 즉시 확인:** 재생 중에는 헤더 알약과 상태 패널이 진한 녹색으로 바뀌고 `● PLAYING 4,000 Hz RIGHT EAR`처럼 주파수·귀를 크게 표시합니다. 재생 중인 주파수 버튼도 채워지고 맥박 표시가 생깁니다.
- **키보드만으로 검사:** `Space` 제시 · `1–6` 주파수 · `L/R/B` 귀 · `H` 들림 · `N` 안 들림 · `↑/↓` 레벨 ±5 · `Esc` 모든 소리 정지. 한글 입력 상태에서도 동작합니다(물리 키 기준).
- **간이 검사 모드:** 들림 → 10 내림, 안 들림 → 5 올림. 올라가며 제시한 같은 레벨에서 2회 들리면 그 레벨을 역치로 자동 기록합니다(수정 Hughson-Westlake 단순화). 기록값은 표에서 언제든 수정할 수 있습니다.
- **취약 주파수는 참고만:** 귀별로 역치가 높은 순서로 정렬하고 1–2위를 Audiogram·표·목록에서 강조합니다. 자극음 주파수는 자동으로 채우지 않으며, 의료진이 목록 옆 `A`/`B` 버튼이나 프리셋 칩(칩에 `R1`, `L2` 같은 검사 참고 표시)으로 직접 고릅니다.
- **생성 전 확인 → 미리듣기 → 생성 → 다운로드:** 확인 카드에 주파수, A:B 음량, 마스터, 길이, 출력, 형식, 예상 크기, 파일명을 보여 줍니다. 생성 후 설정을 바꾸면 이전 파일은 다운로드할 수 없게 막습니다.
- **개인정보 최소화:** 환자 ID·날짜·메모만 받습니다(이름·주민번호 필드 없음). 파일명에 환자 정보를 넣지 않습니다(예: `soundtherapy_4000Hz_8000Hz_10min_20260929.wav`).

### 안전장치

| 항목 | 구현 |
| --- | --- |
| 낮은 시작 음량 | 검사 출력 20 %(≈ −65 dBFS), 자극음 마스터 35 %(피크 ≈ −29 dBFS) |
| 높은 출력 경고 | 검사 70 %·마스터 70 % 이상에서 경고. 80 % 초과는 '고출력 허용'을 켜야 가능, 다시 끄면 즉시 80 %로 내림 (기록·프리셋을 불러올 때도 적용) |
| gain ramp | 시작·종료 30 ms 램프, 재생 중 레벨 변경은 20 ms 시간상수로 부드럽게 |
| 주파수 변경 시 pop 방지 | 새 소리와 이전 소리를 30 ms 교차 페이드 |
| 긴급 정지 | 헤더의 큰 `모든 소리 즉시 정지` 버튼(항상 표시)과 `Esc` — 12 ms 안에 모든 Voice 정지 |
| 누적 방지 | 현재 Voice는 하나. 페이드아웃 중인 Voice도 추적해 긴급 정지 시 함께 정지, 끝나면 모든 노드 disconnect |
| 남는 소리 방지 | 탭 숨김·창 전환 시 모든 소리 정지, 페이지 이탈 시 AudioContext 닫기, 화면 오류 시에도 정지(ErrorBoundary) |
| 클리핑 방지 | 각 순음 0.35(상대 음량 50), 한 채널 합이 0.9를 넘으면 비율 유지 정규화, 마지막에 ±1 리미터 |
| 재생 불가 주파수 | 출력 장치 샘플레이트의 나이퀴스트 이상은 버튼 비활성화·재생 안 함 (예: 16 kHz 블루투스 헤드셋에서 8 kHz) |

## 3. 소스코드

전체 소스는 `src/` 폴더에 있습니다. TypeScript strict 모드로 오류 없이 컴파일됩니다(`npm run typecheck`).

## 4. package.json 의존성

| 패키지 | 용도 | 라이선스 |
| --- | --- | --- |
| react, react-dom 19 | 화면 | MIT |
| lucide-react | 아이콘 (홈페이지와 같은 Lucide 라인 아이콘) | ISC |
| @breezystack/lamejs | 브라우저 MP3 인코더 (LAME의 JS 포팅, ES 모듈) | **LGPL-3.0** |
| vite 8, @vitejs/plugin-react, typescript 6 | 개발·빌드 | MIT / Apache-2.0 |

글꼴: NanumSquare(네이버, OFL), Pretendard(OFL) — 디자인 시스템에서 가져온 파일을 `src/assets/fonts`에 포함.

## 5. 설치

Node.js 20.19 이상(권장 22 LTS 이상)이 필요합니다.

```bash
cd soyul-audiometry
npm install
```

## 6. 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`을 엽니다(Chrome·Edge 권장). 같은 네트워크의 태블릿에서 열려면 `npm run dev -- --host`로 실행하고 표시되는 주소로 접속합니다.

진료실 PC에 설치해 쓸 때는 빌드 결과를 사용합니다.

```bash
npm run build
npm run preview
```

`dist/` 폴더는 정적 파일이라 원내 PC의 아무 정적 서버로도 제공할 수 있습니다(인터넷 연결 불필요).

### GitHub Pages 배포

코드를 고친 뒤 아래 한 줄이면 https://dws1019.github.io/soyul-audiometry/ 가 갱신됩니다.

```bash
npm run deploy
```

`/soyul-audiometry/` 경로 기준으로 빌드한 `dist/`를 `gh-pages` 브랜치에 올리고, GitHub Pages는 그 브랜치를 제공합니다(반영까지 1–2분). 소스 변경은 평소처럼 `main` 브랜치에 커밋·푸시합니다.

- 저장소 이름을 바꾸면 `package.json`의 `build:pages` 경로(`--base=/저장소이름/`)도 함께 바꿉니다.
- GitHub Actions로 자동 배포하려면 워크플로 파일을 올릴 권한이 필요합니다: `gh auth refresh -s workflow`.
- GitHub Pages 사이트는 누구나 열 수 있는 공개 주소입니다. 프로그램 자체만 공개되며, 환자 기록은 서버에 올라가지 않습니다.

## 7. 주요 기능 테스트 방법

처음에는 **헤드폰을 쓰지 않은 상태**에서 PC 볼륨을 낮게 두고 확인하세요.

1. **안내 화면** — 첫 화면의 4개 안내 카드와 고지 문구 확인. `환자에게 크게 보여 주기`로 큰 글씨 화면 확인.
2. **채널 라우팅** — `오른쪽 귀` 선택 후 1 kHz를 누르면 오른쪽에서만, `왼쪽 귀`면 왼쪽에서만 소리가 나는지 확인. 헤더에 `● PLAYING 1,000 Hz RIGHT EAR`.
3. **재생 방법** — `누르고 있는 동안 재생`: 버튼·Space를 누르는 동안만 재생. `1초 재생`: 1초 후 자동 정지. 소리 시작·끝에 '딱' 소리가 없어야 함.
4. **안전** — 재생 중 `Esc` 또는 `모든 소리 즉시 정지`. 슬라이더를 80 % 위로 올리려 하면 멈추고, `고출력 허용`을 켜야 올라감. 다시 끄면 80 %로 내려감. 누른 채 다른 창을 클릭하면 소리가 멈춤.
5. **간이 검사** — 오른쪽 귀·4 kHz, 20 %에서 `N, H, N, N, H` → 25 %가 역치로 자동 기록되고 표·Audiogram에 반영.
6. **결과 입력·Audiogram** — 표에 값을 넣으면 오른쪽 O(빨강 실선)·왼쪽 X(파랑 점선)로 그려지고, 점에 마우스를 올리면 귀·주파수·역치 표시. 귀별 1–2위에 점선 원과 순위.
7. **취약 주파수 → 선택** — 목록에서 `A`/`B`를 눌러 자극음 주파수로 지정(자동 지정 없음). `직접 입력`에 `13000`, `100`, `abc`, `4000.55`를 넣으면 오류가 나고 생성 버튼이 막힘.
8. **미리듣기·생성** — `자극음 미리듣기(8초)` → `정지`. `음원 생성` 후 `WAV 다운로드`. 받은 파일을 오디오 편집기(예: Audacity)의 스펙트럼 보기로 열어 두 주파수만 있는지, 앞뒤 페이드가 있는지 확인. 30분 WAV(약 318 MB)는 약 15–20초, 30분 MP3는 약 2–3분 걸립니다(진행률·취소 가능).
9. **좌우 각각 다른 설정** — 왼쪽 A+B, 오른쪽 C+D가 각 채널에만 들어가는지 확인.
10. **기록** — `검사 저장` → 기록 목록에 표시 → 새로고침해도 유지 → `불러오기`. `JSON/CSV 내보내기`, `JSON 가져오기`, `결과 인쇄`, Audiogram `이미지 저장`.
11. **교정 모드(개발 확인용)** — 톱니 아이콘에서 교정표에 임시 값(예: 모두 −100 dBFS)을 넣고 저장하면 레벨이 dB HL로 바뀌고 표 단위도 dB HL이 됩니다. 확인 후 `교정표 삭제`.

개발자 확인: 브라우저 콘솔에서 오디오 엔진 상태를 볼 수 있습니다.

```js
const { audioEngine } = await import('/src/utils/audioEngine.ts')
audioEngine.getSnapshot()
```

## 8. 의료용으로 쓰기 전에 필요한 교정·검증

이 프로그램의 비교정 모드 값(출력 %)은 **dB HL이 아니며**, 같은 PC·같은 헤드폰·같은 볼륨 설정 안에서의 상대 비교에만 쓸 수 있습니다. 임상 청력검사로 쓰려면 아래가 필요합니다.

**교정 (Calibration)**
- [ ] 트랜스듀서 선정: 청력검사용 헤드폰(예: DD45, TDH-39, HDA 300) 또는 삽입형 이어폰. 일반 이어폰·블루투스 헤드폰은 부적합(블루투스는 지연·자동 음량 처리·샘플레이트 변경 가능).
- [ ] 출력 체인 고정: 전용 PC 또는 USB 오디오 인터페이스, OS 볼륨 고정값, 음향 효과·라우드니스 보정·공간 음향 끄기, 드라이버 샘플레이트 고정(44.1/48 kHz).
- [ ] 측정: IEC 60318 인공귀/커플러 + Class 1 음압계로 주파수·귀별 기준음(`측정용 기준음`, 예 −30 dBFS)의 dB SPL 측정 → RETSPL(ISO 389-1/-2, 트랜스듀서별 값)로 0 dB HL 기준 dBFS 계산 → 교정표 입력.
- [ ] 직선성: 각 주파수에서 −10 ~ 최대 dB HL까지 5 dB 간격으로 레벨 직선성 측정(허용 오차 확인).
- [ ] 주파수 정확도·왜곡: 주파수 오차, 전고조파왜곡(THD) 측정.
- [ ] 반대쪽 누화(crosstalk)·차폐: 좌우 채널 누설 측정. 현재 버전에는 차폐음(masking noise) 기능이 없음 — 좌우 역치 차이가 큰 환자 검사에는 차폐 기능 추가 필요.
- [ ] 정기 교정: 매일 청각 확인(listening check), 연 1회 이상 정밀 교정, OS 업데이트·장비 교체 시 재측정.

**검증 (Validation)**
- [ ] 교정된 임상 청력검사기와 동일 대상자 비교 검사(재현성·일치도, 예: ±5 dB 이내 비율).
- [ ] 검사 환경: ISO 8253-1 수준의 주변 소음(방음 부스 또는 측정된 조용한 방).
- [ ] 소프트웨어 검증: 채널 라우팅, 레벨 변환, 안전 한계, 파일 생성(주파수·길이·피크) 자동 테스트 추가. 브라우저·OS 버전 고정.
- [ ] 자극음 파일: 환자가 사용할 기기(휴대폰·이어폰)에서의 실제 재생 음압 확인 및 사용 안내(볼륨·사용 시간) 문서화.
- [ ] 개인정보: 원내 PC 브라우저 저장소 접근 관리, JSON/CSV 내보낸 파일의 보관·폐기 규정.
- [ ] 규제: 청력검사 목적의 소프트웨어는 의료기기(SaMD)에 해당할 수 있으므로 식약처 의료기기 해당 여부 확인. 의료광고 원칙(치료 효과 단정 표현 금지) 준수.
- [ ] 라이선스: MP3 인코더 `@breezystack/lamejs`는 LGPL-3.0입니다. 외부에 배포할 경우 라이브러리 교체 가능성 보장 등 LGPL 조건을 확인하세요(원내 사용만 할 때는 영향이 적음).

### 확장 지점

- 검사 주파수 추가(예: 3·6 kHz): `config/constants.ts`의 `TEST_FREQUENCIES`만 바꾸면 버튼·표·Audiogram(로그 눈금)·분석이 함께 바뀝니다.
- 교정 계산: `utils/levels.ts`의 `computePresentationGains`가 레벨 → 신호 변환의 유일한 관문입니다. 트랜스듀서별 RETSPL 표, 주파수 간 보간 등을 여기에 추가합니다.
- 좌우 독립 음원: 합성 명세 `StimulusSpec.channels`가 좌우 채널별 성분 목록이라, 채널당 성분 수를 늘려도 엔진·Worker·WAV 코드는 그대로 동작합니다.
- 개발 서버 설정의 `server.fs.allow`에 프로젝트 실제 경로를 넣은 것은, 프로젝트가 심볼릭 링크나 OS 폴더 리디렉션 아래에 있을 때 Worker 파일이 막히지 않게 하기 위함입니다.
