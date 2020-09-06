<!-- h1'd to stop the VSCode extension that generates the table of contents from including it -->
<h1>RepoSync</h1>

**A handy, non-frustrating package synchronizer.** Designed for compatibility with React Native's [Metro](https://facebook.github.io/metro/) bundler. An alternative to npm and yarn's `link` (symbolic link) functionality.

###### Table of Contents

- [How It Works](#how-it-works)
- [Usage](#usage)
  - [a](#a)
  - [Configuration](#configuration)

## How It Works

RepoSync reads the `package.json` file from the source directory specified on each `instance` within `sync.json`. It copies all the files that would be typically published to [npm](https://npm.com) into the **output directory**'s `node_modules` folder specified on the same instance

## Usage

RepoSync is designed to be simple and easy-to-use.

### a

### Configuration

Copy `sync.example.json` to a file called `sync.json`.
