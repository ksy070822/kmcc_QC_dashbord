# SSH 키 설정 가이드

## 1단계: 기존 SSH 키 확인

터미널에서 다음 명령어 실행:

```bash
# SSH 키가 있는지 확인
ls -al ~/.ssh
```

다음 파일들이 보이면 이미 SSH 키가 있습니다:
- `id_rsa` / `id_rsa.pub` (RSA 키)
- `id_ed25519` / `id_ed25519.pub` (Ed25519 키 - 권장)

## 2단계: SSH 키 생성 (없는 경우)

```bash
# Ed25519 키 생성 (더 안전하고 빠름)
ssh-keygen -t ed25519 -C "your_email@example.com"

# 또는 RSA 키 생성 (기존 시스템 호환성)
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

**프롬프트가 나타나면:**
- 파일 위치: Enter 키 (기본값 사용)
- 비밀번호: Enter 키 (비밀번호 없이) 또는 원하는 비밀번호 입력

## 3단계: SSH 에이전트 시작 및 키 추가

```bash
# SSH 에이전트 시작
eval "$(ssh-agent -s)"

# SSH 키 추가
ssh-add ~/.ssh/id_ed25519
# 또는 RSA 키인 경우:
# ssh-add ~/.ssh/id_rsa
```

## 4단계: 공개 키 복사

```bash
# 공개 키를 클립보드에 복사 (macOS)
pbcopy < ~/.ssh/id_ed25519.pub

# 또는 파일 내용 출력
cat ~/.ssh/id_ed25519.pub
```

## 5단계: GitHub에 SSH 키 추가

1. GitHub 로그인 후 우측 상단 프로필 클릭
2. **Settings** 클릭
3. 왼쪽 메뉴에서 **SSH and GPG keys** 클릭
4. **New SSH key** 클릭
5. 설정:
   - **Title**: "Mac - kmcc-qc-dashbord" (설명)
   - **Key**: 4단계에서 복사한 공개 키 붙여넣기
6. **Add SSH key** 클릭

## 6단계: SSH 연결 테스트

```bash
# GitHub SSH 연결 테스트
ssh -T git@github.com
```

성공 메시지:
```
Hi may070822! You've successfully authenticated, but GitHub does not provide shell access.
```

## 7단계: Git 원격 저장소를 SSH로 변경

```bash
cd /Users/may.08/Desktop/kmcc_qc_dashbord

# 원격 저장소 URL을 SSH로 변경
git remote set-url may git@github.com:may070822/kmcc-qc-dashbord.git

# 확인
git remote -v
```

## 8단계: 푸시 테스트

```bash
git push may main
```

## 문제 해결

### SSH 키가 여러 개인 경우
```bash
# ~/.ssh/config 파일 생성/수정
nano ~/.ssh/config
```

다음 내용 추가:
```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
```

### 권한 오류가 발생하는 경우
```bash
# SSH 키 파일 권한 설정
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
chmod 700 ~/.ssh
```

### SSH 에이전트가 키를 잊어버리는 경우
```bash
# ~/.ssh/config에 다음 추가
Host *
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile ~/.ssh/id_ed25519
```
