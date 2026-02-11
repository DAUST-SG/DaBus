declare module "convex/values" {
  export class ConvexError extends Error {
    constructor(data?: unknown);
  }

  export const v: {
    string: () => any;
    number: () => any;
    boolean: () => any;
    id: (tableName: string) => any;
    optional: (validator: any) => any;
    literal: (value: string | number | boolean) => any;
    union: (...validators: any[]) => any;
  };
}

declare module "convex/server" {
  export const defineSchema: (schema: any) => any;
  export const defineTable: (schema: any) => any;

  export const httpRouter: () => {
    route: (config: { path: string; method: string; handler: any }) => void;
  };
}

declare module "convex/browser" {
  export class ConvexHttpClient {
    constructor(address: string);
    query(name: any, args: any): Promise<any>;
    mutation(name: any, args: any): Promise<any>;
    action(name: any, args: any): Promise<any>;
  }
}
