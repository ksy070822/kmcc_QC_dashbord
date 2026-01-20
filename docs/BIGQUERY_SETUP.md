# BigQuery 연동 설정 가이드

Google Sheets 데이터를 BigQuery로 적재하기 위한 설정 가이드입니다.

## 개요

- **소스**: Google Sheets ([링크](https://docs.google.com/spreadsheets/d/14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o))
- **대상 시트**: 용산, 광주
- **GCP 프로젝트**: csopp-25f2
- **BigQuery 데이터셋**: QC
- **리전**: asia-northeast3 (서울)

## 1단계: GCP 서비스 계정 생성

1. [GCP Console](https://console.cloud.google.com/welcome?project=csopp-25f2) 접속
2. **IAM 및 관리자** > **서비스 계정** 이동
3. **서비스 계정 만들기** 클릭
   - 이름: `qc-dashboard-bigquery`
   - 설명: QC Dashboard BigQuery 연동용
4. 권한 부여:
   - `BigQuery 데이터 편집자` (roles/bigquery.dataEditor)
   - `BigQuery 작업 사용자` (roles/bigquery.jobUser)
5. 키 생성:
   - **키** 탭 > **키 추가** > **새 키 만들기** > **JSON**
   - 다운로드된 JSON 파일 보관

## 2단계: BigQuery 데이터셋 생성

### 옵션 A: GCP Console에서 수동 생성

1. [BigQuery Console](https://console.cloud.google.com/bigquery?project=csopp-25f2) 접속
2. 프로젝트 `csopp-25f2` 선택
3. **데이터 세트 만들기** 클릭
   - 데이터 세트 ID: `QC`
   - 데이터 위치: `asia-northeast3 (서울)`
4. 생성 완료

### 옵션 B: API로 자동 생성

배포 후 아래 URL 호출:
```
GET https://your-app.vercel.app/api/bigquery-sync?action=init
```

## 3단계: 환경 변수 설정

### Vercel 배포 시

1. Vercel 프로젝트 설정 > Environment Variables
2. 아래 변수 추가:

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `BIGQUERY_PROJECT_ID` | `csopp-25f2` | GCP 프로젝트 ID |
| `BIGQUERY_DATASET_ID` | `QC` | BigQuery 데이터셋 이름 |
| `BIGQUERY_LOCATION` | `asia-northeast3` | BigQuery 리전 |
| `BIGQUERY_CREDENTIALS` | `{...JSON...}` | 서비스 계정 키 (JSON 한 줄) |

### JSON 키 한 줄로 변환

다운로드한 JSON 키 파일을 한 줄로 변환:

```bash
# 방법 1: jq 사용
cat service-account-key.json | jq -c .

# 방법 2: Node.js 사용
node -e "console.log(JSON.stringify(require('./service-account-key.json')))"
```

## 4단계: Google Apps Script 설정

1. Google Sheets 열기: [QC 데이터 시트](https://docs.google.com/spreadsheets/d/14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o)

2. **도구** > **Apps Script** 클릭

3. 기존 코드 삭제 후, `lib/google-apps-script-bigquery.ts` 파일의 코드 붙여넣기

4. `WEBAPP_URL` 수정:
   ```javascript
   const WEBAPP_URL = "https://your-actual-vercel-url.vercel.app/api/bigquery-sync";
   ```

5. 저장 (Ctrl+S)

6. `onOpen` 함수 실행 (메뉴 생성용)

7. 스프레드시트 새로고침

## 5단계: 동기화 실행

### 수동 동기화

스프레드시트 메뉴:
- **📊 QC BigQuery** > **🔄 BigQuery로 전체 동기화**

### 자동 동기화 (15분마다)

스프레드시트 메뉴:
- **📊 QC BigQuery** > **⏰ 자동 동기화 설정 (15분마다)**

### API 직접 호출

```bash
# 상태 확인
curl https://your-app.vercel.app/api/bigquery-sync

# BigQuery 초기화
curl https://your-app.vercel.app/api/bigquery-sync?action=init

# 통계 조회
curl "https://your-app.vercel.app/api/bigquery-sync?action=stats&date=2025-01-20"
```

## BigQuery 테이블 스키마

### evaluations 테이블

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | STRING | 고유 ID |
| center | STRING | 센터 (용산/광주) |
| evaluation_date | DATE | 평가일 (파티션 키) |
| service | STRING | 서비스 |
| channel | STRING | 채널 |
| agent_id | STRING | 상담사 ID |
| agent_name | STRING | 상담사 이름 |
| ... (16개 평가항목) | BOOLEAN | Y/N 평가 결과 |
| total_errors | INTEGER | 총 오류 수 |
| attitude_errors | INTEGER | 태도 오류 수 |
| business_errors | INTEGER | 업무 오류 수 |
| created_at | TIMESTAMP | 생성 시간 |
| updated_at | TIMESTAMP | 수정 시간 |

### agents 테이블

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| agent_id | STRING | 상담사 ID |
| agent_name | STRING | 상담사 이름 |
| center | STRING | 센터 |
| service | STRING | 서비스 |
| channel | STRING | 채널 |
| hire_date | STRING | 입사일 |
| tenure_months | INTEGER | 근속 개월 |

## 문제 해결

### 1. 인증 오류

```
Error: Could not load the default credentials
```

→ `BIGQUERY_CREDENTIALS` 환경 변수가 올바르게 설정되었는지 확인

### 2. 권한 오류

```
Error: Access Denied: Dataset csopp-25f2:QC
```

→ 서비스 계정에 BigQuery 권한이 부여되었는지 확인

### 3. 데이터셋/테이블 없음

```
Error: Not found: Dataset csopp-25f2:QC
```

→ `/api/bigquery-sync?action=init` 호출하여 자동 생성

### 4. Apps Script 오류

→ **📋 BigQuery 로그** 시트에서 상세 오류 확인

## 데이터 흐름

```
Google Sheets (용산, 광주 시트)
    ↓ (Apps Script)
    ↓ POST /api/bigquery-sync
Next.js API Route
    ↓ (데이터 변환)
    ↓ BigQuery Client
BigQuery (QC 데이터셋)
    ├── evaluations 테이블 (평가 데이터)
    └── agents 테이블 (상담사 마스터)
```
