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
