import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ParsedUrlQuery } from 'node:querystring';
import type { StormOptions } from '@rayo/storm';

/** Parameters remain URL-encoded. Optional route parameters may be absent. */
export type Params = Record<string, string | undefined>;

export interface Request<P extends Params = Params> extends IncomingMessage {
  ip: string | string[] | undefined;
  pathname: string;
  query: ParsedUrlQuery;
  params: P;
}

/** Extend this interface, or pass a response subtype to rayo(), for middleware helpers. */
export interface Response extends ServerResponse {}

export type Next = (error?: unknown) => unknown;
export type Handler<Req extends Request = Request, Res extends ServerResponse = Response> = (
  req: Req,
  res: Res,
  next: Next
) => unknown;

export interface RouteMatch<Req extends Request = Request, Res extends ServerResponse = Response> {
  params: Params;
  /** Route handlers, including middleware from contributing bridges. */
  stack: Handler<Req, Res>[];
  /** Prepared global and route handlers. Treat this shared array as immutable. */
  dispatchStack: Handler<Req, Res>[];
}

export interface Routing<Req extends Request = Request, Res extends ServerResponse = Response> {
  readonly id: string;
  through(...handlers: Handler<Req, Res>[]): this;
  route(verb: string, path: string, ...handlers: Handler<Req, Res>[]): this;
  fetch(verb: string, path: string): RouteMatch<Req, Res> | null;
  /** Prepare route indexes and middleware stacks. Safe to call repeatedly. */
  prepare(): this;
}

export interface BoundBridge<Req extends Request = Request, Res extends ServerResponse = Response>
  extends Routing<Req, Res> {
  readonly bridgedPath: string;
  get(...handlers: Handler<Req, Res>[]): this;
  head(...handlers: Handler<Req, Res>[]): this;
  post(...handlers: Handler<Req, Res>[]): this;
  put(...handlers: Handler<Req, Res>[]): this;
  delete(...handlers: Handler<Req, Res>[]): this;
  connect(...handlers: Handler<Req, Res>[]): this;
  options(...handlers: Handler<Req, Res>[]): this;
  trace(...handlers: Handler<Req, Res>[]): this;
  patch(...handlers: Handler<Req, Res>[]): this;
  all(...handlers: Handler<Req, Res>[]): this;
}

export interface Bridge<Req extends Request = Request, Res extends ServerResponse = Response>
  extends Routing<Req, Res> {
  readonly bridgedPath: null;
  bridge(path: string): BoundBridge<Req, Res>;
  bridge(path?: null): Bridge<Req, Res>;
  get(path: string, ...handlers: Handler<Req, Res>[]): this;
  head(path: string, ...handlers: Handler<Req, Res>[]): this;
  post(path: string, ...handlers: Handler<Req, Res>[]): this;
  put(path: string, ...handlers: Handler<Req, Res>[]): this;
  delete(path: string, ...handlers: Handler<Req, Res>[]): this;
  connect(path: string, ...handlers: Handler<Req, Res>[]): this;
  options(path: string, ...handlers: Handler<Req, Res>[]): this;
  trace(path: string, ...handlers: Handler<Req, Res>[]): this;
  patch(path: string, ...handlers: Handler<Req, Res>[]): this;
  all(path: string, ...handlers: Handler<Req, Res>[]): this;
}

export interface ListenAddress extends AddressInfo {
  workerPid: number;
}

export interface RayoOptions<Req extends Request = Request, Res extends ServerResponse = Response> {
  host?: string;
  port?: number;
  storm?: StormOptions | null;
  server?: Server | null;
  notFound?: Handler<Req, Res> | null;
  onError?: ((error: unknown, req: Req, res: Res, handler: Handler<Req, Res> | undefined) => unknown) | null;
}

export interface Rayo<Req extends Request = Request, Res extends ServerResponse = Response> extends Bridge<Req, Res> {
  host: string | undefined;
  port: number | undefined;
  server: Server | null;
  stormOptions: StormOptions | null;
  notFound: RayoOptions<Req, Res>['notFound'];
  onError: RayoOptions<Req, Res>['onError'];
  /** In a Storm primary process there is no local HTTP server, so this returns null. */
  start(callback?: (address: ListenAddress) => void): Server | null;
  dispatch(req: IncomingMessage, res: ServerResponse): unknown;
  step(req: Req, res: Res, stack: Handler<Req, Res>[], index?: number, error?: unknown, statusCode?: number): unknown;
}

export default function rayo<Req extends Request = Request, Res extends ServerResponse = Response>(
  options?: RayoOptions<Req, Res>
): Rayo<Req, Res>;
