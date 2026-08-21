import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

// Nests settings + logout under the avatar instead of exposing each as its
// own top-bar icon — same fixed/centered popover shell as
// NotificationBell/StartingSoonIndicator (see .reminder-panel's comment for
// why: readable and never runs off-screen on a narrow phone), just with a
// short menu instead of a scrollable list. Theme lives on the settings page
// itself (see hooks/useTheme.ts) rather than as a menu item here — it's a
// once-in-a-while preference, not something worth a click from every page.
export default function ProfileMenu({
  userName,
  onLogout,
}: {
  userName: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="profile-menu">
      <button
        type="button"
        className="app-nav-avatar"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu de ${userName}`}
        title={userName}
      >
        {initialsOf(userName)}
      </button>
      {open && (
        <>
          <div className="reminder-panel-backdrop" onClick={() => setOpen(false)} />
          <div className="reminder-panel profile-menu-panel" role="menu" aria-label={`Menu de ${userName}`}>
            <div className="reminder-panel-header">
              <span className="reminder-panel-title">{userName}</span>
            </div>
            <button
              type="button"
              role="menuitem"
              className="profile-menu-item"
              onClick={() => {
                setOpen(false);
                navigate("/definicoes");
              }}
            >
              <Settings size={16} aria-hidden="true" />
              Definições
            </button>
            <div className="profile-menu-divider" aria-hidden="true" />
            <button
              type="button"
              role="menuitem"
              className="profile-menu-item profile-menu-item-danger"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              <LogOut size={16} aria-hidden="true" />
              Sair
            </button>
          </div>
        </>
      )}
    </div>
  );
}
