import { isRouteErrorResponse } from "react-router";

export function getErrorPresentation(
  error: unknown,
  includeDebugDetails: boolean,
) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : includeDebugDetails && error.statusText
          ? error.statusText
          : details;
  } else if (includeDebugDetails && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return { message, details, stack };
}
