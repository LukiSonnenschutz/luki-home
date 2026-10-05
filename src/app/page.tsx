import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import Home from "@/components/home";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (!(await getUserId())) redirect("/login");
  const view = (await searchParams).view;
  const tab =
    view === "goals" ||
    view === "training" ||
    view === "tasks" ||
    view === "settings" ||
    view === "history"
      ? view
      : "today";
  return <Home initialTab={tab} />;
}
