# 조직 정책 제약 오류 해결 방법

## 문제
```
ERROR: (gcloud.builds.submit) HTTPError 412: 'us' violates constraint 'constraints/gcp.resourceLocations'
```

이 오류는 조직 정책(Organization Policy)에서 리소스 위치를 제한하고 있어서 발생합니다.

## 해결 방법

### 방법 1: 로컬 Docker 빌드 (권장 - 조직 정책 우회)

조직 정책 제약을 완전히 우회하는 방법입니다:

```bash
# 로컬 Docker 빌드 및 배포 스크립트 실행
./deploy-local-docker.sh
```

이 스크립트는:
1. 로컬에서 Docker 이미지 빌드
2. Artifact Registry에 직접 푸시
3. Cloud Run에 배포

**장점:**
- 조직 정책 제약 완전 우회
- Cloud Build 사용 안 함
- 빠른 배포

**단점:**
- 로컬에 Docker 설치 필요
- 로컬 리소스 사용

### 방법 2: Cloud Build 트리거 사용 (GitHub 연동)

GitHub에 푸시하면 자동으로 빌드되도록 트리거를 설정합니다:

1. **Cloud Console에서 트리거 생성**
   - https://console.cloud.google.com/cloud-build/triggers
   - "트리거 만들기" 클릭
   - **중요**: 리전을 `asia-northeast3`로 명시적으로 설정

2. **트리거 설정**
   - 이름: `qc-dashboard-auto-deploy`
   - 이벤트: `푸시 이벤트`
   - 소스: `may070822/kmcc-qc-dashbord`
   - 브랜치: `^main$`
   - 빌드 구성: `cloudbuild.yaml`
   - **리전**: `asia-northeast3` (반드시 명시!)

3. **GitHub에 푸시하면 자동 배포**
   ```bash
   git push may main
   ```

### 방법 3: 조직 정책 예외 요청

조직 관리자에게 다음 리전 허용을 요청:
- `asia-northeast3` (서울)
- `asia-northeast1` (도쿄) - 필요시

### 방법 4: Cloud Build API 직접 호출

```bash
# 빌드 요청 JSON 생성
cat > /tmp/build-request.json <<EOF
{
  "steps": [...],
  "timeout": "600s"
}
EOF

# API 직접 호출
gcloud builds create \
  --config=/tmp/build-request.json \
  --region=asia-northeast3
```

## 현재 권장 방법

**로컬 Docker 빌드 사용:**

```bash
./deploy-local-docker.sh
```

이 방법이 가장 확실하고 빠릅니다.
