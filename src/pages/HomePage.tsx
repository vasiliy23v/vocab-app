import * as React from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { useTeacherLinks } from "@/hooks/useTeacherLinks"
import StudentDashboard from "@/pages/StudentDashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  const { user } = useAuth()
  const { myStudents, loading } = useTeacherLinks()

  if (!user) return null

  // Everyone is primarily a "student" of their own vocabulary, so the
  // personal dashboard is always shown. If they also teach others,
  // a quick-access panel to their students appears above it.
  return (
    <div className="space-y-6">
      {!loading && myStudents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Мои ученики</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {myStudents.map((s) => (
              <Link
                key={s.id}
                to={`/student/${s.id}`}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-muted/40"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px]">
                    {(s.display_name || s.email).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{s.display_name || s.email}</span>
              </Link>
            ))}
            <Button asChild variant="ghost" size="sm">
              <Link to="/people">+ Пригласить ученика</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <StudentDashboard />
    </div>
  )
}
