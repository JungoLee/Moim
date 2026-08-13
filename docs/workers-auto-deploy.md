# Workers Builds — git push 자동 배포 설정

> 지금은 `npm run worker:deploy` 로 손수 배포한다. GitHub 를 연결하면 **main 에 push 할 때 Cloudflare 가 알아서 빌드·배포**한다.
> 대시보드에서만 되는 설정이라 문서로 남긴다. (형제 프로젝트에도 같은 절차 — 아래 §3 프롬프트 참고)

## 1. 설정 절차 (Moim 기준)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → `moim` 선택
2. **Settings → Build** → **Connect** (Git 저장소 연결)
3. GitHub 인증 → 저장소 `JungoLee/Moim`, 브랜치 `main` 선택
4. 빌드 설정을 아래로 지정

   | 항목 | 값 |
   |---|---|
   | Build command | `npm install && npm --prefix frontend install && npm --prefix frontend run build` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | (비움 — 저장소 루트) |

5. **Save** → 이후 `git push origin main` 이면 자동 배포

### 왜 빌드 명령이 저렇게 긴가
`frontend/out`(정적 export 산출물)은 **gitignore 대상**이라 저장소에 없다. 그래서 Cloudflare 쪽에서 프론트를 직접 빌드해야 `wrangler deploy` 가 올릴 자산이 생긴다.
루트 `install:all` 을 쓰지 않는 이유는 그 안에 구 `backend/`(mongoose 등) 설치가 들어 있어 빌드가 느려지기 때문이다.

## 2. 주의할 점

- **시크릿은 자동 배포와 무관하다.** `wrangler secret` 으로 넣은 값(`JWT_SECRET` 등)은 워커에 그대로 남는다. `wrangler.toml` 의 `[vars]` 만 코드에서 갱신된다.
- **D1 스키마는 자동 적용되지 않는다.** 테이블을 바꿨으면 배포와 별개로 `npm run db:schema:remote` 를 직접 돌릴 것.
- 빌드가 실패하면 배포는 일어나지 않는다(기존 버전 유지). 실패 로그는 같은 Build 탭에서 본다.
- 자동 배포를 켜도 `npm run worker:deploy` 수동 배포는 계속 가능하다.

## 3. 다른 프로젝트에 적용할 때 쓸 프롬프트

형제 프로젝트(MyBudget · Gilo · youtubePlaylist · MenuManager 등) 세션에 그대로 붙여넣으면 된다.

```
이 프로젝트도 Cloudflare Workers 로 배포 중인데, 지금은 wrangler deploy 를 손으로 돌리고 있어.
GitHub push 만으로 자동 배포되게(Workers Builds) 설정하려고 하니, 먼저 이 저장소에 맞는 빌드 설정을 알려줘.

확인해서 알려줄 것:
1. wrangler.toml 의 main·assets(directory) 설정 — 워커가 서빙하는 정적 자산이 어디서 오는지
2. 그 자산 폴더가 gitignore 대상인지 (대상이면 Cloudflare 쪽에서 빌드해야 하므로 build command 가 필요하다)
3. 위를 근거로 대시보드에 넣을 값 3개를 확정해줘
   - Build command (의존성 설치 + 프론트 빌드까지)
   - Deploy command (보통 npx wrangler deploy)
   - Root directory
   ※ 모노레포면 하위 폴더 의존성 설치도 build command 에 포함할 것
4. 자동 배포로 바뀌면 깨질 수 있는 것 점검
   - D1 마이그레이션/스키마 적용이 배포에 묶여 있는지 (Workers Builds 는 스키마를 적용하지 않는다)
   - 빌드 타임에 인라인되는 환경변수(NEXT_PUBLIC_* 등)가 있는지 — 로컬 .env 는 Cloudflare 빌드에 없다.
     있으면 대시보드 빌드 환경변수로 옮겨야 한다
   - wrangler secret 으로 넣은 값은 그대로 유지된다는 점 확인
5. 설정 후 README(또는 docs)의 배포 절차를 "수동 → push 자동" 으로 갱신해줘

대시보드 조작은 내가 할 테니, 어디에 뭘 넣어야 하는지 순서대로 알려줘.
```
