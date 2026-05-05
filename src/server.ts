import "dotenv/config";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { serverConfig } from "./config";
import v1Router from "./routers/v1/index.router";
import v2Router from "./routers/v2/index.router";
import { attachCorrelationIdMiddleware } from "./middlewares/correlation.middleware";
import { appErrorHandler, genericErrorHandler } from "./middlewares/error.middleware";
import ChatManager from "./ws/chat.manager";

const app = express();

app.use(cors());
app.use(express.json());
app.use(attachCorrelationIdMiddleware);

app.use("/api/v1", v1Router);
app.use("/api/v2", v2Router);

app.use(appErrorHandler);
app.use(genericErrorHandler);

// WebSocket server
const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  ws.on("error", console.error);

  ws.on("message", async (raw) => {
    const { type, payload } = JSON.parse(raw.toString());
    let userId = "";

    try {
      const decoded = jwt.verify(payload.token, serverConfig.JWT_SECRET) as { userId: string };
      userId = decoded.userId;
    } catch {
      return;
    }

    switch (type) {
      case "join":
        await ChatManager.getInstance().join(userId, ws);
        break;
      case "chat":
        await ChatManager.getInstance().sendMessage(userId, payload.receiverId, payload.message);
        break;
    }
  });

  ws.on("close", () => ChatManager.getInstance().clearUser(ws));
});

app.listen(serverConfig.PORT, () => {
  console.log(`HTTP server running on http://localhost:${serverConfig.PORT}`);
  console.log(`WebSocket server running on ws://localhost:8080`);
});
