import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { createDatabase } from "../server/db/client";
import { inventoryFacts, orderItems, orders, organizations, products, stores, variants, customers } from "../server/db/schema";
import { money } from "../server/domain/money";
import { PostgresCommerceRepository } from "../server/repositories/postgresCommerce";

function assert(value:unknown,message:string):asserts value { if(!value)throw new Error(message); }
const now=()=>new Date().toISOString();

async function main(){
 if(!process.env.DATABASE_URL||process.env.PROFITPILOT_ALLOW_DB_INTEGRATION_TESTS!=="true"){
  console.log("Skipped: DATABASE_URL and PROFITPILOT_ALLOW_DB_INTEGRATION_TESTS=true are both required.");
  return;
 }
 const db=createDatabase(); const repository=new PostgresCommerceRepository(db); const runId=randomUUID();
 const organizationId=randomUUID(); const storeId=randomUUID(); const otherOrganizationId=randomUUID(); const otherStoreId=randomUUID();
 const scope={organizationId,storeId,mode:"live" as const}; const platform="other"; const ingestedAt=new Date();
 const external=(entity:string)=>`profitpilot-integration-${entity}-${runId}`;
 const product={...scope,id:randomUUID(),externalId:external("product"),source:"manual" as const,name:`Integration Product ${runId}`,sku:`INT-${runId}`,status:"active" as const,createdAt:now(),sourceUpdatedAt:now()};
 const variant={...scope,id:randomUUID(),productId:product.id,externalId:external("variant"),source:"manual" as const,name:`Integration Variant ${runId}`,sku:`INT-V-${runId}`,status:"active" as const,createdAt:now(),sourceUpdatedAt:now()};
 const customer={...scope,id:randomUUID(),externalId:external("customer"),source:"manual" as const,status:"actual" as const,sourceUpdatedAt:now()};
 const orderBase={...scope,customerId:customer.id,source:"manual" as const,status:"paid" as const,currency:"SAR",merchandiseGross:money(10_000),discounts:money(500),shippingCharged:money(250),refundedAmount:money(0),revenueBasis:"tax_inclusive" as const,orderedAt:now(),sourceUpdatedAt:now()};
 try{
  await db.insert(organizations).values({id:organizationId,name:`Integration Organization ${runId}`,defaultCurrency:"SAR",mode:"live"});
  await db.insert(stores).values({id:storeId,organizationId,name:`Integration Store ${runId}`,platform:"other",currency:"SAR",status:"active"});

  const savedProduct=await repository.upsertProduct(product,platform,ingestedAt); const foundProduct=await repository.findProduct(scope,platform,product.externalId);
  assert(savedProduct?.id===product.id&&foundProduct?.name===product.name&&foundProduct.sku===product.sku,"Product did not round-trip.");
  assert(await repository.findProduct({...scope,organizationId:otherOrganizationId},platform,product.externalId)===undefined,"Product crossed organization scope.");
  assert(await repository.findProduct({...scope,storeId:otherStoreId},platform,product.externalId)===undefined,"Product crossed store scope.");
  assert(await repository.findProduct(scope,"salla",product.externalId)===undefined,"Product crossed platform scope.");

  const savedVariant=await repository.upsertVariant(variant,platform,ingestedAt); const foundVariant=await repository.findVariant(scope,platform,variant.externalId);
  assert(savedVariant.id===variant.id&&foundVariant?.productId===product.id&&foundVariant.name===variant.name,"Variant did not round-trip.");
  assert(await repository.findVariant({...scope,storeId:otherStoreId},platform,variant.externalId)===undefined,"Variant crossed store scope.");

  const savedCustomer=await repository.upsertCustomer(customer,platform,ingestedAt); const foundCustomer=await repository.findCustomer(scope,platform,customer.externalId);
  assert(savedCustomer.id===customer.id&&foundCustomer!==undefined,"Customer did not round-trip.");
  assert(foundCustomer.displayName===undefined&&foundCustomer.email===undefined&&foundCustomer.sourceUpdatedAt===customer.sourceUpdatedAt,"Customer null fields did not hydrate correctly.");
  assert(await repository.findCustomer({...scope,organizationId:otherOrganizationId},platform,customer.externalId)===undefined,"Customer crossed organization scope.");

  const zeroTaxOrder={...orderBase,id:randomUUID(),externalId:external("order-zero-tax"),taxAmount:money(0)};
  await repository.upsertOrder(zeroTaxOrder,platform,ingestedAt); const foundZeroTax=await repository.findOrder(scope,platform,zeroTaxOrder.externalId);
  assert(foundZeroTax?.merchandiseGross===10_000&&foundZeroTax.taxAmount===0,"Order zero tax did not round-trip.");
  assert(await repository.findOrder({...scope,storeId:otherStoreId},platform,zeroTaxOrder.externalId)===undefined,"Order crossed store scope.");
  const unknownTaxOrder={...orderBase,id:randomUUID(),externalId:external("order-unknown-tax")};
  await repository.upsertOrder(unknownTaxOrder,platform,ingestedAt); const foundUnknownTax=await repository.findOrder(scope,platform,unknownTaxOrder.externalId);
  assert(foundUnknownTax?.taxAmount===undefined,"Unknown order tax did not remain unknown.");

  const item={...scope,id:randomUUID(),orderId:zeroTaxOrder.id,productId:product.id,variantId:variant.id,externalId:external("order-item"),source:"manual" as const,title:`Integration Item ${runId}`,quantity:2,returnedQuantity:0,unitGross:money(5_000),discountAmount:money(500),sourceUpdatedAt:now()};
  await repository.upsertOrderItem(item,platform,ingestedAt); const foundItem=await repository.findOrderItem(scope,platform,item.externalId);
  assert(foundItem?.orderId===zeroTaxOrder.id&&foundItem.productId===product.id&&foundItem.variantId===variant.id&&foundItem.quantity===2&&foundItem.unitGross===5_000&&foundItem.discountAmount===500,"Order Item did not round-trip.");
  assert(await repository.findOrderItem({...scope,organizationId:otherOrganizationId},platform,item.externalId)===undefined,"Order Item crossed organization scope.");

  const inventory={...scope,id:randomUUID(),externalId:external("inventory"),productId:product.id,variantId:variant.id,currentStock:0,reservedStock:0,source:"manual" as const,status:"actual" as const,observedAt:now(),sourceUpdatedAt:now()};
  await repository.upsertInventoryFact(inventory,platform,ingestedAt); const foundInventory=await repository.findInventoryFact(scope,platform,inventory.externalId);
  assert(foundInventory?.currentStock===0&&foundInventory.reservedStock===0&&foundInventory.availableStock===undefined&&foundInventory.observedAt===inventory.observedAt&&foundInventory.sourceUpdatedAt===inventory.sourceUpdatedAt,"Inventory null/zero semantics did not round-trip.");
  assert(await repository.findInventoryFact({...scope,storeId:otherStoreId},platform,inventory.externalId)===undefined,"Inventory Fact crossed store scope.");
  const [inventoryRow]=await db.select({ingestedAt:inventoryFacts.ingestedAt}).from(inventoryFacts).where(and(eq(inventoryFacts.organizationId,organizationId),eq(inventoryFacts.storeId,storeId),eq(inventoryFacts.id,inventory.id)));
  assert(inventoryRow?.ingestedAt instanceof Date,"Inventory ingestion timestamp was not persisted.");

  const atomicOrder={...orderBase,id:randomUUID(),externalId:external("atomic-order"),taxAmount:money(125)};
  const atomicItem={...scope,id:randomUUID(),orderId:atomicOrder.id,productId:product.id,variantId:variant.id,externalId:external("atomic-item"),source:"manual" as const,title:`Atomic Item ${runId}`,quantity:1,returnedQuantity:0,unitGross:money(10_000),discountAmount:money(0),sourceUpdatedAt:now()};
  await repository.persistOrderWithItems(atomicOrder,platform,ingestedAt,[atomicItem]);
  const foundAtomicOrder=await repository.findOrder(scope,platform,atomicOrder.externalId); const foundAtomicItem=await repository.findOrderItem(scope,platform,atomicItem.externalId);
  assert(foundAtomicOrder?.taxAmount===125&&foundAtomicItem?.orderId===atomicOrder.id,"Atomic Order + Items persistence did not commit together.");
  console.log(`PASS: live PostgreSQL commerce repository integration (${runId}).`);
 }finally{
  await db.delete(inventoryFacts).where(and(eq(inventoryFacts.organizationId,organizationId),eq(inventoryFacts.storeId,storeId)));
  await db.delete(orderItems).where(and(eq(orderItems.organizationId,organizationId),eq(orderItems.storeId,storeId)));
  await db.delete(orders).where(and(eq(orders.organizationId,organizationId),eq(orders.storeId,storeId)));
  await db.delete(variants).where(and(eq(variants.organizationId,organizationId),eq(variants.storeId,storeId)));
  await db.delete(customers).where(and(eq(customers.organizationId,organizationId),eq(customers.storeId,storeId)));
  await db.delete(products).where(and(eq(products.organizationId,organizationId),eq(products.storeId,storeId)));
  await db.delete(stores).where(eq(stores.id,storeId));
  await db.delete(organizations).where(eq(organizations.id,organizationId));
 }
}

main().then(()=>process.exit(0)).catch(error=>{console.error(`FAIL: ${error instanceof Error?error.message:"Unknown integration test error"}`);process.exit(1);});
