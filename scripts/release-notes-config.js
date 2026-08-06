import conventionalCommits from "conventional-changelog-conventionalcommits";

const types = [
  { type: "feat", section: "Features" },
  { type: "feature", section: "Features" },
  { type: "fix", section: "Bug Fixes" },
  { type: "perf", section: "Performance Improvements" },
  { type: "revert", section: "Reverts" },
  {
    type: "refactor",
    scope: "no-release",
    section: "Code Refactoring",
    hidden: true,
  },
  { type: "refactor", section: "Code Refactoring" },
  { type: "build", scope: "runtime", section: "Build System" },
  { type: "build", section: "Build System", hidden: true },
  {
    type: "chore",
    scope: "deps-runtime",
    section: "Runtime Dependencies",
  },
  { type: "chore", section: "Miscellaneous Chores", hidden: true },
  { type: "docs", section: "Documentation", hidden: true },
  { type: "style", section: "Styles", hidden: true },
  { type: "test", section: "Tests", hidden: true },
  { type: "ci", section: "Continuous Integration", hidden: true },
];

export default function releaseNotesConfig() {
  return conventionalCommits({ types });
}
