import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// pino-http types diverge between CJS and ESM resolution; cast resolves TS2349
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const httpLogger = (pinoHttp as any)({
  logger,
  serializers: {
    req(req: { id?: string; method?: string; url?: string }) {
      return {
        id: req.id,
        method: req.method,
        url: req.url?.split("?")[0],
      };
    },
    res(res: { statusCode?: number }) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});

app.use(httpLogger);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
