# 🎨 ash SSH Client - 아이콘 설정 가이드

## 📋 필요한 아이콘 파일들

### 1. 기본 아이콘 파일
`assets/icons/icon.png` (1024x1024px 권장)

### 2. 자동 생성되는 파일들
- `icon.ico` (Windows용)
- `icon.icns` (macOS용)
- `icon.png` (Linux용)

## 🛠️ 아이콘 생성 방법

### 방법 1: 온라인 도구 사용 (권장)
1. **App Icon Generator**: https://appicon.co/
   - 1024x1024 PNG 파일 업로드
   - 모든 플랫폼용 아이콘 자동 생성

2. **Electron Icon Generator**: https://www.electron.build/icons
   - Electron 전용 아이콘 생성

### 방법 2: 로컬 도구 사용
```bash
# 1. 1024x1024 PNG 파일을 assets/icons/icon.png에 저장

# 2. 아이콘 변환 실행
npm run build-icons

# 3. 빌드 테스트
npm run make
```

### 방법 3: 수동 생성
```bash
# macOS에서 ICNS 생성
iconutil -c icns assets/icons/icon.iconset

# ImageMagick으로 ICO 생성 (Windows/Linux)
convert assets/icons/icon.png -define icon:auto-resize=256,128,64,48,32,16 assets/icons/icon.ico
```

## 📁 파일 구조
```
assets/
└── icons/
    ├── icon.png      # 소스 파일 (1024x1024)
    ├── icon.ico      # Windows용 (자동 생성)
    ├── icon.icns     # macOS용 (자동 생성)
    └── icon.png      # Linux용 (자동 생성)
```

## 🎯 아이콘 디자인 가이드

### 권장 사항
- **크기**: 1024x1024px (최소 512x512px)
- **형식**: PNG (투명 배경 지원)
- **스타일**: 단순하고 명확한 디자인
- **색상**: SSH 클라이언트다운 색상 (검정, 회색, 파랑 등)

### SSH 클라이언트 아이콘 아이디어
- 🔐 자물쇠 + 터미널
- 💻 터미널 창
- 🌐 서버 연결
- ⚡ SSH 로고 스타일
- 🔑 키 + 서버

## 🚀 빌드 및 테스트

```bash
# 아이콘 생성 후 빌드
npm run build-icons
npm run make

# 특정 플랫폼 빌드
npx electron-forge make --platform=win32 --arch=x64
npx electron-forge make --platform=darwin --arch=arm64
npx electron-forge make --platform=linux --arch=x64
```

## 📝 참고사항

- 아이콘 파일이 없으면 기본 Electron 아이콘이 사용됩니다
- 빌드 시 아이콘 파일이 자동으로 포함됩니다
- 각 플랫폼별로 최적화된 아이콘 형식이 사용됩니다
