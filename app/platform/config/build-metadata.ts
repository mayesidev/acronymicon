const developmentVersion = "development";

export function resolveApplicationVersion(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : developmentVersion;
}

export const applicationVersion = resolveApplicationVersion(
  import.meta.env.VITE_ACRONYMICON_VERSION,
);
