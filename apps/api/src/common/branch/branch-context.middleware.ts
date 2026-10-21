import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { bindBranchContext } from './branch-context';

@Injectable()
export class BranchContextMiddleware implements NestMiddleware {
  use(_request: Request, _response: Response, next: NextFunction) {
    bindBranchContext(() => next());
  }
}
