/** A contained, still background: no private catalog artwork or continuous animation. */
export function LoginBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-login-background" />
      <div className="absolute inset-0 bg-linear-to-br from-login-glow/25 via-transparent to-primary/5" />
    </div>
  );
}
