// 빌드 후 정적 파일 복사 (크로스플랫폼)
const fs = require('fs');

const targets = [
  { src: 'src/web/public', dest: 'dist/src/web/public' },
  { src: 'templates', dest: 'dist/templates' },
];

for (const { src, dest } of targets) {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true });
  }
  fs.cpSync(src, dest, { recursive: true });
}
