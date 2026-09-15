import type { NextFunction, Request, RequestHandler, Response } from "express";

export const asyncHandler = <
  TParams = Request["params"],
  TBody = unknown,
  TQuery = Request["query"],
>(
  handler: (req: Request<TParams, unknown, TBody, TQuery>, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler<TParams, unknown, TBody, TQuery> => (req, res, next) => {
  void Promise.resolve(handler(req, res, next)).catch(next);
};
