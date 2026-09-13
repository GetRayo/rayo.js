# Releases

The **Publish** workflow releases all five packages from `master`: `rayo`, `@rayo/compress`, `@rayo/send`, `@rayo/storm`, and `@rayo/benchmarks`.
Select `patch`, `minor`, or `major` for each release. Lerna applies that increment to every package's current version and updates workspace dependency references and the lockfile. Package versions remain independent.

## Setup

1. Merge `.github/workflows/publish.yml` into `master`. GitHub displays **Run workflow** once the workflow exists on the default branch.
2. Add the repository Actions secret `RELEASE_TOKEN`: a fine-grained personal access token restricted to `GetRayo/rayo.js`, with **Contents: Read and write**. Its owner must be a repository administrator permitted to update `master` under the existing branch protection. The current classic protection permits administrator updates; keep the protection settings unchanged.
3. Keep the existing `CODACY_PROJECT_TOKEN` and `SNYK_TOKEN` secrets configured. Publishing requires the existing Test, Coverage, and Security jobs to pass.
4. Configure a GitHub Actions trusted publisher in npm's settings for each of the five packages, using the values below. Enable direct publishing with `npm publish` in **Allowed actions**.

| npm trusted publisher field | Value |
| --- | --- |
| Organisation or user | `GetRayo` |
| Repository | `rayo.js` |
| Workflow filename | `publish.yml` |
| Environment name | Leave empty |

The workflow uses Node.js 24 and npm trusted publishing with OIDC. The publish job has `id-token: write`; npm generates provenance for these public packages. An `NPM_TOKEN` secret is unnecessary. See [npm's trusted publishing guide](https://docs.npmjs.com/trusted-publishers/) for the package settings.

## Publish

1. Open [Actions → Publish](https://github.com/GetRayo/rayo.js/actions/workflows/publish.yml).
2. Select **Run workflow**, choose `master`, and select the version increment. The default is `patch`.
3. Start the workflow and wait for validation, CI, versioning, and publishing to finish.

The workflow tests the selected revision, creates a GitHub-verified version commit on `master`, and publishes the packages from that commit. It checks the packed files before publishing. Release runs execute sequentially.

The packages' `gitHead` and release tags identify the generated version commit. Provenance identifies the workflow revision selected when the run was started.

After all five versions are available on npm, the workflow creates a `<package-name>@<version>` tag for each package and one GitHub release at `rayo@<version>`. That release lists all five package versions and includes generated release notes. All five tags point to the version commit.

## Retry a failed run

Use **Re-run failed jobs** on the existing run. A publishing retry uses the recorded version commit, skips versions already published from that commit, and completes any missing tags or GitHub release.

**Re-run all jobs** also recovers the same version commit when it is the identical first child of the original revision. A conflicting version commit stops the run. Starting a new **Run workflow** request applies another version increment.

Published versions must match the recorded release commit. A version already present on npm with another `gitHead`, or a release tag pointing to another commit, requires investigation before retrying.

An older partial run stops if publishing a missing package would move npm's `latest` tag backwards. Start a new Publish run for the next version. A fully published older run can still complete its GitHub release without replacing the latest release.

## Local package checks

Run these from the repository root:

```sh
npm ci
npm test
npm run copies
npm run pack:check
```

The package check verifies the files npm will pack, including the runtime files, declarations, READMEs, and licences.
