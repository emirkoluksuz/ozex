import "express-serve-static-core";

declare module "http" {
  interface IncomingMessage {
    id?: string;
  }
}
