<!-- h1'd to stop the VSCode extension that generates the table of contents from including it -->
<h1>RepoSync</h1>

**A handy, non-frustrating package synchronizer.** Designed for compatibility with React Native's [Metro](https://facebook.github.io/metro/) bundler. An alternative to npm and yarn's `link` (symbolic link) functionality.

---

##### Table of Contents

- [How It Works](#how-it-works)
  - [Instances](#instances)
  - [Repositories](#repositories)
- [Getting Started](#getting-started)
  - [Configuration](#configuration)
- [License](#license)

---

## How It Works

Each [instance](#instances) of RepoSync reads the `package.json` of each source repository within `sync.json`. It copies all the files that would be typically published to [npm](https://npm.com) into the `node_modules` folder of each output repository.

### Instances

An **instance** of RepoSync is a set of input and output [repositories](#repositories), in which **all** input repositories' contents will be copied to **all** output repositories' `node_modules` directories.

### Repositories

A **repository** is somewhat analogous to an npm package. In the case of RepoSync specifically, a repository is defined (by configuration) as a directory that contains a `package.json` file.

---

## Getting Started

RepoSync is designed to be extremely easy to use. You can read the sections below for specific instructions, or follow this basic guide:

1. **[Configuration](#configuration)**
   1. Duplicate the `sync.example.json` file as `sync.json`.
   1. Edit the (relative or absolute) paths to your input and output [repositories](#repositories).
1. **Running**
   1. Run RepoSync once with `yarn start`, or in [watch mode](#watch-mode) with `yarn watch`.
1. **Done!**

### Configuration

RepoSync runs based on parameters that are set in `sync.json`, the main configuration file. An example `sync.json` template can be found in `sync.example.json`.

A simple example for `sync.json` is as follows:

```json
{
  "instances": [
    {
      "sources": [
        "../path/to/source/repository" // RepoSync will read package.json within this directory
      ],
      "outputs": [
        "../path/to/output/repository" // node_modules will be found by RepoSync automatically
      ]
    }
  ]
}
```

---

## License

RepoSync is released under the ISC License. See the [LICENSE](./LICENSE) file for details.
