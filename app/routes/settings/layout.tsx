import { Outlet } from "react-router";

import { Menu } from "~/components/settings/settings-menu";
import type { Route } from "./+types/layout";

export default function Layout(_: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-10">
      <Menu />
      <Outlet />
    </div>
  );
}
