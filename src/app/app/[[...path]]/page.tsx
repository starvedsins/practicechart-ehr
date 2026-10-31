import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, SESSION_COOKIE } from "@/lib/auth";
import Workspace from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function AppPage() {
  const actor = await getSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!actor) redirect("/login");
  return <Workspace actor={actor} demo={process.env.DEMO_MODE === "true"} />;
}
