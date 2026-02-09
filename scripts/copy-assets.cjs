// 빌드 후 정적 파일 복사 (크로스플랫폼)
// Vite가 frontend → dist/src/web/public 직접 출력하므로 public 복사 불필요
const fs = require('fs');

const targets = [
  { src: 'templates', dest: 'dist/templates' },
];

for (const { src, dest } of targets) {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true });
  }
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
  }
}
