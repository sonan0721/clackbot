import chalk from 'chalk';

// 간단한 콘솔 로거 (한글 메시지)

export const logger = {
  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  },

  success(message: string): void {
    console.log(chalk.green('✓'), message);
  },

  warn(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  },

  error(message: string): void {
    console.error(chalk.red('✗'), message);
  },

  debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(chalk.gray('🔍'), chalk.gray(message));
    }
  },

  /** 들여쓰기 있는 정보 출력 */
  detail(message: string): void {
    console.log(`  ${message}`);
  },

  /** 빈 줄 */
  blank(): void {
    console.log();
  },
};
