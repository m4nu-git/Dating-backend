import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import * as userService from "../services/user.service";
import {
  LoginSchema,
  GoogleLoginSchema,
  RegistrationSchema,
  ImageLikedSchema,
  BehaviourLikedSchema,
  RejectSchema,
  AcceptSchema,
} from "../validators/user.validator";
import { BadRequestError } from "../utils/errors/app.error";

export const login = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return next(new BadRequestError("Invalid request body"));
  const result = await userService.login(parsed.data.email, parsed.data.password);
  res.json(result);
};

export const googleLogin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = GoogleLoginSchema.safeParse(req.body);
  if (!parsed.success) return next(new BadRequestError("Invalid request body"));
  const result = await userService.googleLogin(parsed.data.email);
  res.json(result);
};

export const register = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const body = JSON.parse(req.body.userData);
  const parsed = RegistrationSchema.safeParse(body);
  if (!parsed.success) return next(new BadRequestError("Invalid request body"));

  const files = (req.files as Express.MulterS3.File[]) ?? [];
  const result = await userService.register(parsed.data, files);
  res.status(200).json(result);
};

export const likeImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = ImageLikedSchema.safeParse(req.body);
  if (!parsed.success) return next(new BadRequestError("Invalid request body"));
  await userService.likeImage(Number(req.userId), parsed.data);
  res.json({ message: "Image liked" });
};

export const likeBehaviour = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = BehaviourLikedSchema.safeParse(req.body);
  if (!parsed.success) return next(new BadRequestError("Invalid request body"));
  await userService.likeBehaviour(Number(req.userId), parsed.data);
  res.json({ message: "Behaviour liked" });
};

export const reject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = RejectSchema.safeParse(req.body);
  if (!parsed.success) return next(new BadRequestError("Invalid request body"));
  await userService.reject(Number(req.userId), parsed.data);
  res.json({ message: "Rejected successfully" });
};

export const accept = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = AcceptSchema.safeParse(req.body);
  if (!parsed.success) return next(new BadRequestError("Invalid request body"));
  await userService.accept(Number(req.userId), parsed.data);
  res.json({ message: "Accepted successfully" });
};

export const getAllLikes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const result = await userService.getAllLikes(Number(req.userId));
  res.json(result);
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const result = await userService.getMe(Number(req.userId));
  res.json(result);
};

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const otherUserId = Number(req.params.id);
  if (!otherUserId) return next(new BadRequestError("Invalid user id"));
  const result = await userService.getProfile(Number(req.userId), otherUserId);
  res.json(result);
};

export const getChats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const otherUserId = Number(req.params.id);
  if (!otherUserId) return next(new BadRequestError("Invalid user id"));
  const result = await userService.getChats(Number(req.userId), otherUserId);
  res.json(result);
};

export const getAllMatches = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const result = await userService.getAllMatches(Number(req.userId));
  res.json(result);
};

export const getMatches = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const result = await userService.getMatches(Number(req.userId));
  res.json(result);
};
