declare module "@semantic-release/commit-analyzer" {
  type ReleaseType =
    | "major"
    | "premajor"
    | "minor"
    | "preminor"
    | "patch"
    | "prepatch"
    | "prerelease";

  type ReleaseRule = {
    type?: string;
    scope?: string;
    release: ReleaseType | false;
  };

  type AnalyzerOptions = {
    releaseRules?: ReleaseRule[];
  };

  type AnalyzerContext = {
    commits: Array<{ hash: string; message: string }>;
    cwd: string;
    logger: { log: (message: string, ...values: unknown[]) => void };
  };

  export function analyzeCommits(
    pluginConfig: AnalyzerOptions,
    context: AnalyzerContext,
  ): Promise<ReleaseType | null>;
}

declare module "@semantic-release/release-notes-generator" {
  type ReleaseNotesOptions = {
    config?: string;
  };

  type ReleaseNotesContext = {
    commits: Array<{ hash: string; message: string }>;
    lastRelease: { gitHead: string; gitTag: string };
    nextRelease: { gitHead: string; gitTag: string; version: string };
    options: { repositoryUrl: string };
    cwd: string;
  };

  export function generateNotes(
    pluginConfig: ReleaseNotesOptions,
    context: ReleaseNotesContext,
  ): Promise<string>;
}
