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

/**
 * Just the properties we care about lol
 */
export interface PackageJson {
  name: string;
  syncDir?: string;
  files?: string[];
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
}

export class RepoSync {
  private _done: boolean = false;

  private inputs: {
    [name: string]: {
      mode: 'dir' | 'files';
      /**
       * Absolute paths to every file/folder to watch.
       */
      files?: string[] | string;
    };
  } = {};

  private outputs: {
    [name: string]: string; // path
  } = {};

  constructor(inputDirs: string[], outputDirs: string[], watch: boolean) {
    for (const inputDir of inputDirs) {
      // get the package.json in each input
      const inPackage = this.getPackage(inputDir);

      // if there are no inputs in the package.json, fuck em
      if (!inPackage || (!inPackage.files?.length && !inPackage.syncDir)) {
        Logger.error(
          // @ts-expect-error
          `No inputs found for ${inPackage?.name || `package at ${inputDir}`}.`
        );
        return;
      }

      this.inputs[inPackage.name] = {
        mode: inPackage.syncDir ? 'dir' : 'files',
        files:
          (inPackage.syncDir && this.path(inputDir, inPackage.syncDir)) ||
          inPackage.files.map((filePath) => this.path(inputDir, filePath))
      };
    }

    // Set up outputs
    for (const outputDir of outputDirs) {
      if (!this.pathExists(outputDir)) {
        Logger.warn('Repository does not exist at', this.path(outputDir));
        return;
      }

      const outPackage = this.getPackage(outputDir);
      if (!outPackage) {
        Logger.warn('No package.json found for', this.path(outputDir));
        return;
      }

      this.outputs[outPackage.name] = this.path(outputDir, 'node_modules');
    }
  }

  public async sync() {
    console.log({ ins: this.inputs, outs: this.outputs });

    Logger.info(chalk.bold.blue('Cleaning directories...'));
    await this.cleanDirectories();
    Logger.info(chalk.bold.blue('Synchronising directories...'));

    for (let { files } of Object.values(this.inputs)) {
      if (typeof files === 'string') this.watch(files);
      else for (const path of files) this.watch(path);
    }
  }

  private watch(dir: string): void {
    let ignored = [
      `${dir}/**/.*`, // git and dot files
      `${dir}/sync.js`,
      `${dir}/node_modules`
    ];

    chokidar
      .watch(path.resolve(dir), {
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
        this.copyFile(file, dir);
        logUpdate('');
      })
      .on('change', (file) => {
        Logger.debug(`File ${file} has been changed`);
        this.copyFile(file, dir);
      })
      .on('unlink', (file) => {
        Logger.debug(`File ${file} has been removed`);
        this.unlinkFile(file);
      })
      .on('addDir', (dir) => {
        Logger.debug(`Directory ${dir} has been added`);
        this.mkdir(dir, dir);
      })
      .on('unlinkDir', (dir) => {
        Logger.debug(`Directory ${dir} has been removed`);
        this.rmdir(dir);
      })
      .on('ready', () => {
        if (process.env.NODE_ENV === 'production' || !this.watch) {
          process.exit(0);
        }
        setTimeout(() => {
          Logger.info(
            `${chalk.bold.blue('Sync complete')} (${chalk.green.bold(`${dir}`)})`
          );

          this.done();
          LoggerConsole.level = 'debug';
        }, 1000);
      })
      .on('error', (error) => {
        Logger.error(`Watcher error: ${error}`);
      });
    // .on('all', (event) => {
    //   log.debug(`Event triggered: ${event}`);
    // });
  }

  /* UTILITY FUNCTIONS */

  private done(done: boolean = true) {
    if (!this._done) {
      setTimeout(() => {
        Logger.info(chalk.yellow('Waiting for changes...'));
      }, 1000);

      this._done = true;
    }
  }

  private async cleanDirectories(): Promise<void> {
    // for the dest repos
    for (const repo of Object.values(this.outputs)) {
      for (const { files } of Object.values(this.inputs)) {
        const rmPaths = [];

        if (typeof files === 'string') rmPaths.push(files);
        else {
          for (const path of files) rmPaths.push(path);
        }

        for (const path of rmPaths) {
          const x = this.pathSegments(path);
          let repoName = x[x.length - 1];
          let key = `${repo}/${repoName}`;
          logUpdate(key);
          await rimraf.sync(key);
        }
      }
    }
    logUpdate('done');
    return;
  }

  private pathExists(dir: string) {
    return fs.existsSync(this.path(dir));
  }

  private mkdir(dir: string, repo: string) {
    for (const output of Object.values(this.outputs)) {
      let outDir = this.pathSegments(output);
      outDir.pop();
      let dirName = this.path(`../${dir.split(`${outDir.join('/')}/`)[1]}`);

      const dest = this.destPath(repo, dirName);
      if (!this.pathExists(dest)) {
        try {
          fs.mkdirSync(dest);
          logUpdate(`${chalk.grey('Created directory')} ${dir}`);
        } catch (error) {
          Logger.silly(`Create directory ${dir} error: ${error}`);
        }
      }
    }
  }

  /**
   * Remove a directory from all outputs.
   * @param dir Directory to remove
   */
  private rmdir(dir: string) {
    for (const repo of Object.values(this.outputs)) {
      const dest = this.destPath(repo, dir);

      console.log({ dest });

      if (fs.existsSync(dest)) {
        try {
          fs.rmdirSync(dest);
          logUpdate(`Deleted directory ${dir}`);
        } catch (error) {
          Logger.silly(`Delete directory ${dir} error: ${error}`);
        }
      }
    }
  }

  private copyFile(file: string, input: string) {
    for (const output of Object.values(this.outputs)) {
      try {
        let inDirectory = input.split(path.sep);
        inDirectory.pop();
        let fileName = this.path(`../${file.split(`${inDirectory.join('/')}/`)[1]}`);

        fs.copyFileSync(this.path(file), this.destPath(output, fileName));
        logUpdate(chalk.grey('Copied file: ') + file);
      } catch (error) {
        Logger.silly(`Copy file ${file} error: ${error}`);
      }
    }
  }

  private unlinkFile(file) {
    for (const output of Object.values(this.outputs)) {
      try {
        fs.unlinkSync(this.destPath(output, file));
        logUpdate(`Deleted file ${file}`);
      } catch (error) {
        Logger.silly(`Delete file ${file} error: ${error}`);
      }
    }
  }

  private path(...segments: string[]) {
    return path.resolve(...segments);
  }

  private destPath(repo: string, item: string) {
    return this.path(`${repo}/${path.basename(this.path('.'))}/${item}`);
  }

  private pathSegments(dir: string): string[] {
    return this.path(dir).split(path.sep);
  }

  private getFolderName(dir: string): string {
    const segments = this.pathSegments(dir);
    return segments[segments.length - 1];
  }

  private getPackage(dir: string): PackageJson | false {
    const packagePath = this.path(dir, 'package.json');
    if (!fs.existsSync(packagePath)) {
      Logger.warn(`No package.json found for package at directory:${eol} ${dir}`);
      return false;
    }

    return require(packagePath);
  }
}
