# GitHub 저장소 접근 권한 설정 가이드

## 방법 1: 저장소 접근 권한 부여 (저장소 소유자가 해야 함)

### 1단계: GitHub 저장소 접속
1. https://github.com/may070822/kmcc-qc-dashbord 접속
2. `may070822` 계정으로 로그인

### 2단계: Collaborator 추가
1. 저장소 페이지에서 **Settings** 클릭
2. 왼쪽 메뉴에서 **Collaborators** 클릭
3. **Add people** 버튼 클릭
4. `ksy070822` 사용자 이름 또는 이메일 입력
5. 권한 선택: **Write** (쓰기 권한)
6. 초대 전송

### 3단계: 초대 수락 (ksy070822 계정)
1. `ksy070822` 계정으로 GitHub 접속
2. 알림 또는 이메일에서 초대 확인
3. 초대 수락

## 방법 2: Personal Access Token 사용 (권장)

### 1단계: Personal Access Token 생성
1. GitHub 로그인 후 우측 상단 프로필 클릭
2. **Settings** 클릭
3. 왼쪽 메뉴 하단 **Developer settings** 클릭
4. **Personal access tokens** → **Tokens (classic)** 클릭
5. **Generate new token** → **Generate new token (classic)** 클릭
6. 설정:
   - **Note**: "kmcc-qc-dashbord-push" (설명)
   - **Expiration**: 원하는 기간 선택
   - **Scopes**: `repo` 체크 (전체 저장소 권한)
7. **Generate token** 클릭
8. **토큰 복사** (한 번만 표시됨!)

### 2단계: Git에 토큰 사용
```bash
# 원격 저장소 URL에 토큰 포함
git remote set-url may https://YOUR_TOKEN@github.com/may070822/kmcc-qc-dashbord.git

# 또는 푸시 시 사용자명에 토큰 사용
git push https://YOUR_TOKEN@github.com/may070822/kmcc-qc-dashbord.git main
```
