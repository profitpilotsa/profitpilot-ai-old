import { ApiError, type User } from "../phase1";
export interface AuthenticatedSubject { subject: string; email?: string; }
export interface AuthVerifier { verifyBearer(token: string): Promise<AuthenticatedSubject>; }
/** Server-only verifier; browser sessions never receive privileged credentials. */
export class SupabaseAuthVerifier implements AuthVerifier {
  constructor(private readonly fetcher: typeof fetch = fetch, private readonly environment = process.env) {}
  async verifyBearer(token: string): Promise<AuthenticatedSubject> {
    const url = this.environment.SUPABASE_URL; const anonKey = this.environment.SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new ApiError("SERVICE_UNAVAILABLE", "Supabase Auth is not configured", true);
    if (!token || token.length > 16_384) throw new ApiError("UNAUTHORIZED", "A valid access token is required");
    const response = await this.fetcher(`${url.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: anonKey, authorization: `Bearer ${token}` } });
    if (!response.ok) throw new ApiError("UNAUTHORIZED", "The access token is invalid or expired");
    const data = await response.json() as { id?: unknown; email?: unknown };
    if (typeof data.id !== "string" || !data.id) throw new ApiError("UNAUTHORIZED", "Supabase Auth returned an invalid identity");
    return { subject: data.id, email: typeof data.email === "string" ? data.email : undefined };
  }
}
export function toUser(id: string, subject: AuthenticatedSubject): User { return { id, externalSubject: subject.subject, email: subject.email }; }
