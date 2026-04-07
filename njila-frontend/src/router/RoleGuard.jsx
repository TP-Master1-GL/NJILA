import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export const RoleGuard = ({ children, roles }) => {
  const { role } = useAuthStore();

  if (!roles.includes(role)) {
    return <Navigate to="/non-autorise" replace />;
  }
  return children;
};
