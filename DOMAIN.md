# 출시와 도메인 연결 순서

순서대로 진행합니다. 1단계를 먼저 해야 새 기능(회원 탈퇴·이용 제한)이 작동합니다.

## 1. Firebase 규칙·인덱스 배포 (웹사이트보다 먼저)

새 규칙은 기존 사이트와 호환됩니다. 먼저 배포해도 기존 회원에게 영향이 없습니다.

```text
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project chagok1-173f9
```

- 규칙 변경: 본인 계정 문서 삭제(탈퇴), `bans/{uid}` 이용 제한, 본인 댓글 조회(탈퇴 시 삭제용)
- 인덱스 변경: `comments.authorUid` 컬렉션 그룹 인덱스. 생성에 몇 분 걸립니다. 콘솔 Firestore → 색인에서 완료를 확인합니다.

## 2. 웹사이트 배포

`main`에 병합하면 GitHub Actions가 검사 후 Pages에 배포합니다.

## 3. 도메인 구입 후 DNS 설정

도메인 업체(가비아, Cloudflare 등)의 DNS 관리에서 아래 레코드를 추가합니다.

| 호스트 | 종류 | 값 |
|---|---|---|
| @ | A | 185.199.108.153 |
| @ | A | 185.199.109.153 |
| @ | A | 185.199.110.153 |
| @ | A | 185.199.111.153 |
| www | CNAME | leegyuhuen-ux.github.io |

Cloudflare를 쓰면 프록시(주황 구름)를 끄고 ‘DNS only’로 둡니다. 인증서 발급이 막힐 수 있습니다.

## 4. GitHub 설정

1. 계정 Settings → Pages → Add a domain에서 도메인 소유를 인증합니다. 안내된 TXT 레코드를 DNS에 추가합니다. 다른 사람이 도메인을 가로채는 것을 막습니다.
2. 저장소 Settings → Pages → Custom domain에 도메인(예: `chagok.kr`)을 입력하고 저장합니다. Actions 배포 방식이라 `CNAME` 파일은 필요 없습니다.
3. DNS 확인이 끝나면 Enforce HTTPS를 켭니다. 인증서 발급에 최대 1시간 정도 걸립니다.

## 5. Firebase·Google 로그인 설정 (빠뜨리면 로그인 불가)

1. Firebase 콘솔 → Authentication → 설정 → 승인된 도메인에 `chagok.kr`, `www.chagok.kr`을 추가합니다. 없으면 `auth/unauthorized-domain` 오류가 납니다.
2. Google Cloud 콘솔(프로젝트 chagok1-173f9) → Google 인증 플랫폼 → 브랜딩에서 아래를 입력합니다. 로그인 창에 표시되는 정보입니다.
   - 앱 홈페이지: `https://chagok.kr`
   - 개인정보처리방침: `https://chagok.kr/privacy.html`
   - 서비스 약관: `https://chagok.kr/terms.html`
   - 승인된 도메인: `chagok.kr`

## 6. 도메인이 정해지면 코드에 반영할 것

도메인을 알려주면 바로 반영합니다.

- `index.html`: `<link rel="canonical">`, `og:url`, `og:image`(공유 미리보기 이미지)
- `robots.txt`: `Sitemap:` 줄과 `sitemap.xml`
- `404.html`은 도메인 루트(`/`) 기준으로 만들어져 있어 연결 후 바로 맞게 동작합니다.

## 7. 개인정보처리방침 확인

- Firebase 콘솔 → Firestore → 데이터베이스의 위치(예: `asia-northeast3` 서울)를 확인하고 `privacy.html` 3항 ‘이전 국가’를 실제 위치로 고칩니다.
- 시행일(2026년 10월 22일)을 실제 공개일로 맞춥니다.
- 운영자 표기(바라티)와 연락처 메일이 맞는지 확인합니다.

## 8. 연결 후 점검 (약 15분)

1. `https://도메인` 접속 → 자물쇠 표시 확인, `http://`와 `www`가 HTTPS 주소로 이동하는지 확인
2. Google 로그인 → 기록 저장 → 다른 브라우저에서 같은 계정으로 기록 확인
3. 두 번째 계정으로 글·댓글·신고 → 관리자 계정에서 신고 확인, 이용 제한·해제
4. 테스트 계정으로 회원 탈퇴 → 글·댓글이 사라졌는지 확인
5. 휴대폰에서 첫 화면, 이용약관, 개인정보처리방침 확인
