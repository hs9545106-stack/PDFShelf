
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase-client";

type AccessStatus = "checking" | "allowed" | "denied";

export default function AdminRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<AccessStatus>("checking");

  useEffect(() => {
    let active = true;

    async function checkAccess(userId: string | undefined) {
      if (!userId) {
        if (active) setStatus("denied");
        return;
      }

      const { data, error } = await supabase
        .from("admin_users")
        .select("role, is_active")
        .eq("user_id", userId)
        .maybeSingle();

      if (!active) return;

      const allowed =
        !error &&
        !!data &&
        data.is_active === true &&
        ["owner", "admin"].includes(data.role);

      setStatus(allowed ? "allowed" : "denied");
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        if (active) setStatus("denied");
        return;
      }

      void checkAccess(data.session?.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void checkAccess(session?.user.id);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (status === "checking") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          color: "#17243b",
          background: "#f7f6f2",
        }}
      >
        Checking administrator access...
      </div>
    );
  }

  if (status === "denied") {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
