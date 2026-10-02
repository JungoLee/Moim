---
name: worklog
description: 하루 작업 기록(.agent-history)이나 주간보고(weekly-report)를 쓸 때 — 17시 이후·세션 종료 시 기록 위치·양식·쓰지 말 것, 매주 목요일 주간보고 작성 규칙.
---
# 작업 기록 (.agent-history)
- **17시 이후**이거나 세션을 종료·이동할 때는(하루 1회) 오늘 작업을 아래 규칙으로 기록한다. 시각이 불확실하면 명령으로 확인한다.
- 기록 위치: `C:/.agent-history/daily/{YYYY-MM-DD}/moim.md` — 파일이 있으면 **append**, 절대 덮어쓰지 않는다. 폴더가 없으면 만든다.
- 양식: `C:/.agent-history/WORKLOG-TEMPLATE.md`. 요구사항 원문은 받은 그대로 보존하고, 요청 출처(고객 원문/사내 전달/내가 정리/AI 추론)와 해석·보완을 분리해 적는다.
- 쓰지 말 것(중앙 기록에만 적용): 고객사명·기획 의도·화면 내용·카피 문구, 키·토큰·계정·개인정보.
- 기록 후 `C:/.agent-history` 저장소에 커밋한다 (push는 사용자 확인 후).

## 주간보고 (weekly-report — 보고용, 프로젝트 내부)
- 17시 기록 때 `weekly-report/daily/{YYYY-MM-DD}.md` 에도 오늘 이 프로젝트에서 한 일을 **구체적으로** 적는다 (git 제외 폴더라 자유롭게).
- **매주 목요일**: `weekly-report/daily/` 의 지난 한 주치를 참고해 `weekly-report/weekly/{YYYY-MM-DD}.md` 를 작성한다 — 사용자가 복사해 상급자에게 메일로 보내는 보고문.
- 이 폴더는 `.gitignore` 등재 — 커밋하지 않는다.
