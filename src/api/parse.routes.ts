import type { IncomingMessage, ServerResponse } from 'node:http';
import { ParseController } from './parse.controller.js';

export function createParseRoutes(controller: ParseController) {
  return {
    postParse: (req: IncomingMessage, res: ServerResponse) => controller.handleCreateParse(req, res),
    getParse: (req: IncomingMessage, res: ServerResponse, job_id: string) =>
      controller.handleGetParse(req, res, job_id),
    postCorrections: (req: IncomingMessage, res: ServerResponse, job_id: string) =>
      controller.handleCorrections(req, res, job_id),
  };
}

