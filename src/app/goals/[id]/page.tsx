import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import Home from "@/components/home";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getUserId())) redirect("/login");
  return <Home initialGoalId={(await params).id} initialTab="goals" />;
}
