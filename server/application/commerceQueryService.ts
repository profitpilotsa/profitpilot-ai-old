import { authorize, type RequestContext } from "../phase1";
import type { Product } from "../domain/commerce";

export interface ScopedCommerceReader { listProducts(scope: RequestContext["scope"], platform: string): Promise<Product[]>; }
/** Server application boundary: callers receive canonical data only after authorization. */
export class CommerceQueryService {
  constructor(private readonly repository: ScopedCommerceReader) {}
  async listProducts(context: RequestContext, platform: string): Promise<Product[]> { authorize(context, "commerce.read"); return this.repository.listProducts(context.scope, platform); }
}
