import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function SetupRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const path = sessionStorage.getItem("setup_redirect");
    if (path) {
      sessionStorage.removeItem("setup_redirect");
      navigate(path, { replace: true });
    }
  }, [navigate]);

  return null;
}
