import { RepoSync, RSConfig } from './sync';
import { EOL as eol } from 'os';
import chalk from 'chalk';
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

export const LoggerConsole = new winston.transports.Console({
  level: 'info'
});

export const Logger = winston.createLogger({
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    verbose: 3,
    debug: 4,
    silly: 5
  },
  format: winston.format.combine(
    winston.format.cli(),
    winston.format.timestamp(),
    winston.format.printf((info) => `${info.level}: ${info.message}`)
  ),
  transports: [LoggerConsole]
});

console.log(generateHeader());

const args: string[] = process.argv.slice(2);
/**
 * All argv that don't start with a `-` character (signifies being a flag)
 */
const argsNonFlag = args.filter((arg) => !arg.startsWith('-'));
const argValues = {
  watch: args.includes('--watch') || args.includes('-w')
};

let config: RSConfig;

if (argsNonFlag.length > 0) {
  if (argsNonFlag[0].endsWith('.json') && fs.existsSync(path.resolve(argsNonFlag[0]))) {
    config = require(path.resolve(argsNonFlag[0]));
  }
} else {
  config = require('../sync.json');
}

for (const instance of config.instances) {
  new RepoSync(instance.source, instance.output, argValues.watch).sync();
}

function generateHeader(padWidth: number = 7): string {
  const consoleHeader = `RepoSync v${require('../package.json').version}`;
  let line = '+';
  let sidePad = '';

  for (let i = 0; i < padWidth + 1; i++) {
    sidePad += ' ';
  }

  for (let i = 0; i < consoleHeader.length + padWidth * 2; i++) {
    line += '-';
  }

  line += '+';

  return (
    line + eol + eol + sidePad + chalk.bold(consoleHeader) + sidePad + eol + eol + line
  );
}
