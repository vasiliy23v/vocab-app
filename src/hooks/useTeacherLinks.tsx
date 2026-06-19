import * as React from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { Profile, TeacherLink } from "@/types/db"

export interface LinkedPerson extends Profile {
  link_id: string
}

export function useTeacherLinks() {
  const { user } = useAuth()
  const [myTeachers, setMyTeachers] = React.useState<LinkedPerson[]>([])
  const [myStudents, setMyStudents] = React.useState<LinkedPerson[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    if (!user) {
      setMyTeachers([])
      setMyStudents([])
      setLoading(false)
      return
    }
    setLoading(true)

    const { data: asStudent } = await supabase
      .from("teacher_links")
      .select("id, teacher_id, profiles:teacher_id(id, email, display_name, created_at)")
      .eq("student_id", user.id)

    const { data: asTeacher } = await supabase
      .from("teacher_links")
      .select("id, student_id, profiles:student_id(id, email, display_name, created_at)")
      .eq("teacher_id", user.id)

    setMyTeachers(
      (asStudent ?? []).map((row: any) => ({
        ...(row.profiles as Profile),
        link_id: row.id as string,
      }))
    )
    setMyStudents(
      (asTeacher ?? []).map((row: any) => ({
        ...(row.profiles as Profile),
        link_id: row.id as string,
      }))
    )
    setLoading(false)
  }, [user])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel("teacher_links_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teacher_links" },
        () => load()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, load])

  const removeLink = async (linkId: string) => {
    await supabase.from("teacher_links").delete().eq("id", linkId)
    await load()
  }

  return { myTeachers, myStudents, loading, removeLink, refresh: load }
}

export async function createInviteCode(): Promise<{ code: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("create_invite")
  if (error) return { code: null, error: error.message }
  return { code: (data as any)?.code ?? null, error: null }
}

export async function redeemInviteCode(code: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("redeem_invite", { p_code: code.trim().toUpperCase() })
  if (error) return { error: error.message }
  return { error: null }
}
