/**
 * Minimal type declarations for the untyped `amazon-paapi` package.
 * Covers only the GetItems surface we use in scripts/refresh-amazon.ts.
 * Responses are navigated with optional chaining, so `any` is acceptable here.
 */
declare module "amazon-paapi" {
  export interface CommonParameters {
    AccessKey: string;
    SecretKey: string;
    PartnerTag: string;
    PartnerType: string;
    Marketplace: string;
    Host?: string;
    Region?: string;
  }

  export interface GetItemsRequest {
    ItemIds: string[];
    ItemIdType?: string;
    Condition?: string;
    Resources?: string[];
  }

  // PA-API responses are deeply nested and optional; callers guard with ?.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function GetItems(
    commonParameters: CommonParameters,
    requestParameters: GetItemsRequest
  ): Promise<any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function SearchItems(commonParameters: CommonParameters, requestParameters: any): Promise<any>;

  const _default: {
    GetItems: typeof GetItems;
    SearchItems: typeof SearchItems;
  };
  export default _default;
}
