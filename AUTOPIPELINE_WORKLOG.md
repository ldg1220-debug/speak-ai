# AutoPipeline 작업 이력

> 레포: `ldg1220-debug/AutoPipeline` · 브랜치: `feature/shopping-web-app`

## 완료된 작업

### 웹 쇼핑 파이프라인 (`web/`)

| 항목 | 내용 |
|------|------|
| **번역 품질** | `hasChinese()` 검증 추가 → 결과에 한자 없으면 중국어 프롬프트로 재시도 → 그래도 실패 시 원문 한국어 유지 |
| **브랜드명 오삽입 방지** | 입력에 브랜드 없으면 번역에 브랜드 절대 추가하지 않도록 프롬프트 수정 |
| **Bilibili 검색 개선** | 중국어 쿼리일 때 `评测` 접미사 자동 추가 |
| **Pexels 폴백 제거** | STEP 2에서 완전히 제거, 버튼·sourceMessages·에러 배너 삭제 |
| **타오바오 쿠키 UI** | 팝업 차단 우회용 📋 쿠키 입력 버튼 추가, Chrome DevTools 탭 구분 형식 지원 |
| **타오바오 스크래퍼 재작성** | React 리디자인 후 구 CSS 선택자(`.m-itemlist`, `[data-item-id]`) 교체 → alicdn 이미지 기반 상품 감지 |
| **상품 URL 필터** | 로고/배너/공안마크 오인식 수정 → `item.taobao.com`, `detail.tmall.com`, `detail.taobao.com` 링크 보유 이미지만 상품으로 인정 |
| **이미지 프록시** | `/api/proxy-image` — alicdn에 `Referer: https://www.taobao.com/` 헤더 추가 |
| **타오바오 타임아웃 개선** | `waitUntil: 'load'` → `domcontentloaded` + `waitForFunction` 8초로 단축 |
| **0건 진단 로그** | alicdn 이미지 수·타오바오 링크 수·샘플 URL 출력 추가 |

### 앱 파이프라인 (`src/`)

| 항목 | 내용 |
|------|------|
| **ElevenLabs TTS 폴백** | Clova Voice 401 실패 시 ElevenLabs로 자동 전환 |

---

## 미완 작업

- [ ] **Grok 모델 교체** — `src/agents/media_generator.js` : `grok-2-image-1212` → `grok-imagine-image` (2026-02-24 deprecated)
- [ ] **키워드 연도 필터** — 현재 연도 기준 2년 이상 된 연도 포함 키워드 제거 (예: "수분크림 추천 2022")
- [ ] **토픽 중복 제거** — 유사 변형 키워드를 1개 포스트로 그룹핑 (다이소/px/아기/어린이 선스틱 → 하나)
- [ ] **타오바오 0건 문제** — `sampleLinks` 진단 로그 확인 후 URL 패턴 추가 수정
- [ ] **"에스트라" 번역 오류** — Bilibili에서 3D 카메라(Orbbec Astra) 영상 섞이는 문제

---

_마지막 확인: 2026-06-06 · GitHub 마지막 업데이트: 2026-05-31 + 2026-06-05 보조컴 작업_
