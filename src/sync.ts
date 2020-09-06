import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import * as chokidar from 'chokidar';

import chalk from 'chalk';
import logUpdate from 'log-update';

import { EOL as eol } from 'os';

import { Logger, LoggerConsole } from '.';

export interface RSConfig {
  instances: {
    source: string[];
    output: string[];
  }[];
}

export class RepoSync {
  constructor(private inputDirs: string[], private outputDirs: string[], private watch: boolean) {}

  public sync() {}
}

export function sync(inputDirs: string[], outputDirs: string[], watch: boolean) {
  function searchForRepositories() {
    const foundRepos = [];

    for (let _repo of outputDirs) {
      let _found = path.resolve(`${_repo}`);
      if (_found) foundRepos.push(_found);
    }

    if (foundRepos.length === 0) {
      Logger.error('No repositories found');
    } else {
      Logger.info(chalk.bold.green('Found repositories: ') + foundRepos.map((repo) => `${eol}  ${repo}`).join(''));
    }

    return foundRepos;
  }

  function readGitIgnore(_path) {
    if (!fs.existsSync(path.resolve(`${_path}/.gitignore`))) return false;

    return fs
      .readFileSync(path.resolve(`${_path}/.gitignore`), {
        encoding: 'utf-8'
      })
      .split(eol)
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item.indexOf('#') === -1)
      .filter((item) => {
        return item !== 'dist';
      })
      .map((item) => (item.charAt(item.length - 1) === '/' ? item.substr(0, item.length - 1) : item));
  }
  function readRepoSyncIgnore(_path) {
    if (!fs.existsSync(path.resolve(`${_path}/.reposyncignore`))) return false;

    return fs
      .readFileSync(path.resolve(`${_path}/.reposyncignore`), {
        encoding: 'utf-8'
      })
      .split(eol)
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item.indexOf('#') === -1)
      .map((item) => (item.charAt(item.length - 1) === '/' ? item.substr(0, item.length - 1) : item));
  }

  function cleanDirectories() {
    return new Promise(async (resolve) => {
      // for the dest repos
      for (let repo of outputDirs) {
        for (let destPath of inputDirs) {
          let x = destPath.split('/');
          let repoName = x[x.length - 1];
          let key = `${repo}/${repoName}`;
          logUpdate(key);
          await rimraf.sync(key);
        }
      }
      logUpdate('done');
      resolve();
    });
  }

  function destPath(repo, item) {
    return path.resolve(`${repo}/${path.basename(path.resolve('.'))}/${item}`);
  }

  function copyFile(file, _watch) {
    outputDirs.forEach((repo) => {
      try {
        let watchDirectory = _watch.split('/');
        watchDirectory.pop();
        let fileName = `../${file.split(`${watchDirectory.join('/')}/`)[1]}`;
        fs.copyFileSync(path.resolve(file), destPath(repo, fileName));
        logUpdate(chalk.grey('Copied file: ') + file);
      } catch (error) {
        Logger.silly(`Copy file ${file} error: ${error}`);
      }
    });
  }

  function unlinkFile(file) {
    outputDirs.forEach((repo) => {
      try {
        fs.unlinkSync(destPath(repo, file));
        logUpdate(`Deleted file ${file}`);
      } catch (error) {
        Logger.silly(`Delete file ${file} error: ${error}`);
      }
    });
  }

  function mkDir(dir, _watch) {
    outputDirs.forEach((repo) => {
      let watchDirectory = _watch.split('/');
      watchDirectory.pop();
      let dirName = `../${dir.split(`${watchDirectory.join('/')}/`)[1]}`;

      const dest = destPath(repo, dirName);
      if (!fs.existsSync(dest)) {
        try {
          fs.mkdirSync(dest);
          logUpdate(`${chalk.grey('Created directory')} ${dir}`);
        } catch (error) {
          Logger.silly(`Create directory ${dir} error: ${error}`);
        }
      }
    });
  }

  function unlinkDir(dir) {
    outputDirs.forEach((repo) => {
      const dest = destPath(repo, dir);
      if (fs.existsSync(dest)) {
        try {
          fs.rmdirSync(dest);
          logUpdate(`Deleted directory ${dir}`);
        } catch (error) {
          Logger.silly(`Delete directory ${dir} error: ${error}`);
        }
      }
    });
  }

  let _done = false;
  function done() {
    if (!_done) {
      setTimeout(() => {
        Logger.info(chalk.yellow('Waiting for changes...'));
      }, 1000);
      _done = true;
    }
  }

  async function run() {
    Logger.info(chalk.bold.blue('Searching for target directories...'));
    outputDirs = searchForRepositories();
    Logger.info(chalk.bold.blue('Cleaning directories...'));
    await cleanDirectories();
    Logger.info(chalk.bold.blue('Synchronising directories...'));

    for (let _watch of inputDirs) {
      let ignored = [
        `${_watch}/**/.*`, // git and dot files
        `${_watch}/sync.js`,
        `${_watch}/node_modules`
      ];

      chokidar
        .watch(path.resolve(_watch), {
          persistent: true,
          ignored,
          ignoreInitial: false,
          followSymlinks: false,
          cwd: path.resolve('.'),
          disableGlobbing: false,
          usePolling: true,
          interval: 100,
          binaryInterval: 300,
          alwaysStat: false,
          depth: 99,
          awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100
          },
          ignorePermissionErrors: false,
          atomic: true // or a custom 'atomicity delay', in milliseconds (default 100)
        })
        .on('add', (file) => {
          Logger.debug(`File ${file} has been added`);
          copyFile(file, _watch);
          logUpdate('');
        })
        .on('change', (file) => {
          Logger.debug(`File ${file} has been changed`);
          copyFile(file, _watch);
        })
        .on('unlink', (file) => {
          Logger.debug(`File ${file} has been removed`);
          unlinkFile(file);
        })
        .on('addDir', (dir) => {
          Logger.debug(`Directory ${dir} has been added`);
          mkDir(dir, _watch);
        })
        .on('unlinkDir', (dir) => {
          Logger.debug(`Directory ${dir} has been removed`);
          unlinkDir(dir);
        })
        .on('ready', () => {
          if (process.env.NODE_ENV === 'production' || !watch) {
            process.exit(0);
          }
          setTimeout(() => {
            Logger.info(`${chalk.bold.blue('Sync complete')} (${chalk.green.bold(`${_watch}`)})`);

            done();
            LoggerConsole.level = 'debug';
          }, 1000);
        })
        .on('error', (error) => {
          Logger.error(`Watcher error: ${error}`);
        })
        .on('all', (event) => {
          // log.debug(`Event triggered: ${event}`);
        });
    }
  }

  run();
}
