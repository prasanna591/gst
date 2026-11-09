import { useEffect, useState } from "react";
import App from "./App";
import Login from "./Login";
import Setup from "./Setup";
import api from "./api";
import { useAuth } from "./authContext";

export default function Root() {
  const { user, checking } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(null);

  useEffect(() => {
    if (user) return;
    api.get("/api/setup/status")
      .then((r) => setNeedsSetup(r.data.needs_setup))
      .catch(() => setNeedsSetup(false));
  }, [user]);

  if (checking || (!user && needsSetup === null)) {
    return <div className="boot-screen">Loading...</div>;
  }
  if (!user && needsSetup) {
    return <Setup onDone={() => setNeedsSetup(false)} />;
  }
  if (!user) return <Login />;
  return <App />;
}