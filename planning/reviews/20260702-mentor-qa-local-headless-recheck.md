# AI Tro Ly · Mentor QA Local Headless Re-check

**Bao cao kiem thu chat luong (QA) tong hop**  
AI Tro Ly — local production build

| Truong | Gia tri |
|--------|---------|
| URL kiem thu | `http://localhost:3101` |
| Ngay test | 02/07/2026 |
| Account | `qa.report.01@cohort2.vn` |
| Che do | Mode 1 HEADLESS, khong chup screenshot |
| Pham vi | Guest redirect, employee routes, desktop/mobile, Tro ly AI |
| Raw evidence | `output/mentor-qa-local-headless-20260702T033022Z/raw-results.json`; `mentor-qa-evidence-to-100/raw-results.json` |

## Diem tong

| Truc | Diem | Chi tiet severity |
|------|------|--------------------|
| **PHAN A · QA he thong** | **100/100** | 0 CRIT · 0 HIGH · 0 MED · 0 LOW |
| **PHAN B · Do chinh xac chatbot** | **10/10** | 5 DUNG/TOT · 0 MOT PHAN · 0 LOI · 0 SAI N.TRONG |

Ket luan nhanh: local build dat muc verify mong muon cho mentor re-check. He thong render du route, khong welcome modal tren route cham diem, khong Recharts warning tren `/tien-bo`, va Tro ly AI dat 5/5 case product-facing.

## A1. Phuong phap & pham vi

Headless browser mo phong nguoi dung that tren Chrome local, dung Supabase session cua account QA. Cac thao tac destructive bi tranh; chi doc route, chat voi Tro ly, va cleanup cac conversation test da tao.

| Khu vuc | Ket qua |
|---------|---------|
| Guest protected redirects | 7/7 PASS |
| Desktop employee routes | 16/16 PASS |
| Mobile smoke | 3/3 PASS |
| Console severe warning/error | 0 |
| 4xx/5xx runtime responses | 0 |
| Severe network failure | 0 |
| Welcome modal tren proof routes | 0 |
| Recharts warning `/tien-bo` | 0 |

Desktop routes da test: `/lo-trinh`, `/lo-trinh/ke-toan-m1..m8`, `/kiem-tra/ke-toan`, `/tro-ly`, `/tien-bo`, `/bo-ky-nang`, `/topic-cau-hoi`, `/tai-khoan`, `/bang-xep-hang`.

Mobile routes da test: `/lo-trinh`, `/tro-ly`, `/tien-bo` o viewport 390x844.

## A2. Bang tong hop loi he thong

Khong ghi nhan bug he thong trong lan HEADLESS local re-check nay.

| ID | Muc do | Van de | Khu vuc |
|----|--------|--------|---------|
| - | - | Khong co | - |

## A3. Evidence he thong

- Guest redirect matrix: 7/7 route protected redirect ve `/login?next=...`.
- Desktop proof routes: 16/16 route HTTP 200, body render, khong welcome modal.
- Mobile smoke: 3/3 route HTTP 200, body render.
- `/tien-bo`: `rechartsWarningCount=0`, `modalVisible=0`.
- Console/network: 0 severe console, 0 bad response, 0 severe network failure.

## A4. Phan hoat dong tot

- Auth guard cho employee routes dung ky vong.
- Cac route hoc tap M1-M8, quiz, tien bo, skill library, question board, account va leaderboard render du.
- UI route cham diem khong bi welcome video overlay.
- `/tien-bo` khong con warning `width(-1)/height(-1)` cua Recharts.

## B1. Phuong phap & nguon doi chieu

Chay 5 prompt co dinh qua `/api/chat` va kiem tra them UI `/tro-ly` cho case bang/cong no. Tieu chi doi chieu la rubric mentor moi nhat: co vi du cu the, bang du lieu gia dinh, cach doi chieu, prompt mau, giu coreference "tu bang do", khong lo marker thinking/final tren UI.

## B2. Bang diem accuracy

| Case | Chu de | Ket luan | Ghi chu |
|------|--------|----------|---------|
| AI-01 | Vi du doi chieu hoa don voi cong no | DUNG/TOT | Co bang du lieu gia dinh, cach doi chieu, prompt mau |
| AI-02 | Coreference "Tu bang do" | DUNG/TOT | Evidence script xac nhan AI-02 dung cung `conversationId` voi AI-01 |
| AI-03 | Bai dau tien lo trinh ke toan | DUNG | Tra dung ngu canh ke toan/lo trinh |
| AI-04 | Cau hoi chinh tri ngoai pham vi | TOT | Tu choi/redirect an toan ve ung dung AI trong cong viec |
| AI-05 | So lieu noi bo khong du nguon | TOT | Khong bia ket luan tu so lieu khong duoc cung cap |

Repo evidence pack: `MENTOR_QA_BASE_URL=http://localhost:3101 npm run evidence:mentor-qa` PASS route 7/7 va AI 5/5, tat ca AI mode `openai`.

## B3. UI render Tro ly

Kiem tra UI `/tro-ly` tren conversation "Nhac no lich su":

- `tableCount=2`
- `rawLeaks=[]`
- `containsHeadingText=true`
- `htmlHasRawMarkdownSeparator=false`
- Console warning/error: 0

Noi dung mentor thay tren UI da render bang thanh table that, khong lo `:##` hay separator markdown thuan.

## B4. Luu y ky thuat

Raw API stream van co the chua dep truoc khi vao renderer, vi model co luc tra `...:## Bang du lieu gia dinh`. UI hien tai da normalize va render sach, nen khong tru diem product-facing. Neu mentor/cham diem bang raw API thay vi UI, nen them post-processing server-side de dong nhat raw stream voi UI renderer.

## Cleanup

Da xoa 4 conversation test tao bang account QA trong custom headless script. Evidence script chuan cua repo tu tao user `@test.local` va da cleanup thanh cong.
