import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { memberships, organizations, stores, users } from "../db/schema";
import type { Membership, Organization, Store, TenantRepository } from "../phase1";

export class PostgresTenantRepository implements TenantRepository {
  constructor(private readonly db: Database) {}
  async findMembership(userId: string, organizationId: string): Promise<Membership | undefined> {
    const [row] = await this.db.select().from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.organizationId, organizationId)));
    return row ? { userId: row.userId, organizationId: row.organizationId, role: row.role as Membership["role"] } : undefined;
  }
  async findOrganization(organizationId: string): Promise<Organization | undefined> {
    const [row] = await this.db.select().from(organizations).where(eq(organizations.id, organizationId));
    return row ? { id: row.id, name: row.name, defaultCurrency: row.defaultCurrency, mode: row.mode as Organization["mode"] } : undefined;
  }
  async findStore(organizationId: string, storeId: string): Promise<Store | undefined> {
    const [row] = await this.db.select().from(stores).where(and(eq(stores.id, storeId), eq(stores.organizationId, organizationId)));
    return row ? { id: row.id, organizationId: row.organizationId, name: row.name, platform: row.platform as Store["platform"], status: row.status as Store["status"] } : undefined;
  }
  async findUserBySubject(subject: string) {
    const [row] = await this.db.select().from(users).where(eq(users.externalSubject, subject));
    return row ? { id: row.id, externalSubject: row.externalSubject, email: row.email ?? undefined } : undefined;
  }
}
