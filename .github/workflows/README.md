# CI/CD Workflows

이 프로젝트는 GitHub Actions를 사용하여 자동 빌드 및 릴리스를 수행합니다.

## Workflows

### 1. Build Workflow (`.github/workflows/build.yml`)

**트리거:**
- `main`, `develop` 브랜치에 push
- Pull Request가 `main`, `develop`에 생성될 때
- 수동 실행 (workflow_dispatch)

**빌드 플랫폼:**
- **Windows**: x64만 (GitHub Actions의 Windows runner는 x64만 지원)
- **macOS**: arm64 및 x64 (macOS runner는 Apple Silicon이므로 Rosetta 2로 x64 빌드)
- **Linux**: x64만 (GitHub Actions의 Linux runner는 x64만 지원)

**아티팩트:**
- 7일간 보관
- 각 플랫폼별로 분리된 아티팩트

### 2. Release Workflow (`.github/workflows/release.yml`)

**트리거:**
- `v*.*.*` 형식의 태그가 push될 때 (예: `v1.0.0`, `v1.1.21`)
- 수동 실행 (workflow_dispatch)

**릴리스 플랫폼:**
- Windows (x64)
- macOS (arm64)
- Linux (x64)

**릴리스 생성:**
- GitHub Releases에 자동 업로드
- 30일간 아티팩트 보관

## 필요한 Secrets

### macOS Code Signing

macOS 앱을 코드 서명하려면 다음 Secret을 설정해야 합니다:

1. GitHub 저장소 → Settings → Secrets and variables → Actions
2. 새 Secret 추가:
   - Name: `APPLE_IDENTITY`
   - Value: `Apple Development: Your Name (TEAM_ID)`

예시:
```
Apple Development: Sungmin Kim (XM4Q8R9Y2G)
```

## 로컬 빌드

### 특정 플랫폼만 빌드
```bash
# Windows x64
npm run make:x64

# macOS arm64
npm run make:arm64
```

### 모든 아키텍처 빌드
```bash
npm run make
```

## 주의사항

1. **Windows arm64**: GitHub Actions의 Windows runner는 x64만 지원하므로 arm64 Windows 빌드는 현재 불가능합니다. Windows arm64용 빌드가 필요하면 별도의 arm64 Windows runner가 필요합니다.

2. **Linux arm64**: GitHub Actions의 Linux runner는 x64만 지원합니다. arm64 Linux 빌드가 필요하면 QEMU를 사용하거나 self-hosted runner가 필요합니다.

3. **macOS 빌드**: macOS runner는 Apple Silicon이므로 arm64는 네이티브로, x64는 Rosetta 2를 통해 빌드됩니다.

4. **Backend 빌드**: Python backend는 cross-compilation을 지원하지 않으므로, 각 아키텍처별로 별도 빌드가 필요합니다. backend가 없는 아키텍처의 경우 Electron 앱만 빌드됩니다.

