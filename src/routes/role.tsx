import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/role")({
  component: RoleRedirect,
});

function RoleRedirect() {
  const nav = useNavigate();
  useEffect(() => {
    nav({ to: "/auth" });
  }, [nav]);
  return null;
}
