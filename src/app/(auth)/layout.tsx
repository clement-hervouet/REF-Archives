import type { ReactNode } from "react";

// La CSP à nonce (src/proxy.ts) exige un rendu à chaque requête : une page prérendue
// au build ne pourrait pas porter le nonce, et ses scripts seraient bloqués.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}