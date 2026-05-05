import { WebSocket } from "ws";
import prisma from "../db";

interface ConnectedUser {
  userId: string;
  socket: WebSocket;
}

export default class ChatManager {
  private static instance: ChatManager;
  private users: Map<string, ConnectedUser> = new Map();

  private constructor() {}

  static getInstance(): ChatManager {
    if (!ChatManager.instance) {
      ChatManager.instance = new ChatManager();
    }
    return ChatManager.instance;
  }

  async join(userId: string, socket: WebSocket) {
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) return;
    this.users.set(userId, { userId, socket });
  }

  async sendMessage(senderId: string, receiverId: string, message: string) {
    const [sender, receiver] = await Promise.all([
      prisma.user.findUnique({ where: { id: Number(senderId) } }),
      prisma.user.findUnique({ where: { id: Number(receiverId) } }),
    ]);

    if (!sender || !receiver) return;

    await prisma.chats.create({
      data: {
        sender_id: Number(senderId),
        receiver_id: Number(receiverId),
        message,
      },
    });

    const receiverWs = this.users.get(receiverId);
    receiverWs?.socket.send(
      JSON.stringify({ type: "chat", payload: { senderId, message } })
    );
  }

  clearUser(socket: WebSocket) {
    for (const [userId, user] of this.users) {
      if (user.socket === socket) {
        this.users.delete(userId);
        break;
      }
    }
  }
}
