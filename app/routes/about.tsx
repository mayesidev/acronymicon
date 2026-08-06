import type { Route } from "./+types/about";
import { AboutPage } from "../features/about/components/about-page";
import { loadAboutPage } from "../features/about/server/api";

export function meta() {
  return [
    { title: "About | Acronymicon" },
    {
      name: "description",
      content: "Acronymicon version, license, and source information",
    },
  ];
}

export function loader({ request }: Route.LoaderArgs) {
  return loadAboutPage(request);
}

export default function About({ loaderData }: Route.ComponentProps) {
  return <AboutPage {...loaderData} />;
}
