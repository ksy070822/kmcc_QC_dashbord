# Cloud Build 리전 설정 가이드

## 문제
Cloud Build가 `global` 리전에서 실행되고 있습니다. 반드시 `asia-northeast3` (서울) 리전에서 실행되어야 합니다.

## 해결 방법

### 방법 1: Cloud Console에서 트리거 수정 (권장)

1. **Google Cloud Console 접속**
   - https://console.cloud.google.com 접속
   - 프로젝트 선택

2. **Cloud Build 트리거 페이지로 이동**
   - 왼쪽 메뉴에서 **Cloud Build** → **트리거** 클릭
   - 또는 직접 URL: https://console.cloud.google.com/cloud-build/triggers

3. **트리거 편집**
   - `global` 리전으로 실행되는 트리거 찾기
   - 트리거 이름 클릭하여 편집

4. **리전 설정 변경**
   - **리전** 섹션 찾기
   - **리전 선택** 드롭다운에서 **asia-northeast3 (Seoul)** 선택
   - 또는 **고급** 섹션에서 **리전** 필드에 `asia-northeast3` 입력

5. **저장**
   - **저장** 버튼 클릭

### 방법 2: gcloud CLI로 트리거 업데이트

```bash
# 트리거 목록 확인
gcloud builds triggers list --region=asia-northeast3

# 트리거 업데이트 (트리거 ID 필요)
gcloud builds triggers update TRIGGER_ID \
  --region=asia-northeast3 \
  --repo=may070822/kmcc-qc-dashbord \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

### 방법 3: 새 트리거 생성 (서울 리전 지정)

```bash
gcloud builds triggers create github \
  --name="kmcc-qc-dashbord-trigger" \
  --region=asia-northeast3 \
  --repo-name="kmcc-qc-dashbord" \
  --repo-owner="may070822" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --substitutions="_SERVICE_NAME=qc-dashboard,_REGION=asia-northeast3"
```

### 방법 4: 수동 빌드 시 리전 지정

```bash
# 수동 빌드 실행 시 반드시 리전 지정
gcloud builds submit --config cloudbuild.yaml --region=asia-northeast3 .
```

## 확인 방법

1. **Cloud Build 히스토리 확인**
   - Cloud Build → 히스토리 페이지에서
   - 각 빌드의 **리전** 컬럼이 `asia-northeast3`인지 확인

2. **빌드 로그 확인**
   - 빌드 상세 페이지에서
   - 리전 정보가 `asia-northeast3`로 표시되는지 확인

## 중요 사항

- ✅ **반드시 `asia-northeast3` (서울) 리전 사용**
- ❌ **`global` 리전 사용 금지**
- ✅ **모든 트리거에 리전 명시**
- ✅ **수동 빌드 시에도 `--region=asia-northeast3` 옵션 사용**

## 트리거 설정 예시

```yaml
# 트리거 설정에서 리전 명시
region: asia-northeast3
```

또는

```json
{
  "name": "kmcc-qc-dashbord-trigger",
  "region": "asia-northeast3",
  "github": {
    "owner": "may070822",
    "name": "kmcc-qc-dashbord"
  },
  "build": {
    "steps": [...],
    "substitutions": {
      "_REGION": "asia-northeast3"
    }
  }
}
```
