import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import ngeohash from "ngeohash";
import BitSet from "bitset";
import { serverConfig } from "../config";
import { addToBloomFilter, existsInBloomFilter } from "../utils/bloom.util";
import { calculateAge } from "../utils/age.util";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../utils/errors/app.error";
import * as userRepo from "../repositories/user.repository";
import {
  TRegistrationSchema,
  TImageLikedSchema,
  TBehaviourLikedSchema,
  TRejectSchema,
  TAcceptSchema,
} from "../validators/user.validator";

type UploadedFile = { location: string };

const signToken = (userId: number) =>
  jwt.sign({ userId }, serverConfig.JWT_SECRET);

export const login = async (email: string, password: string) => {
  const user = await userRepo.findUserByEmail(email);
  if (!user) throw new NotFoundError("User not found");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new BadRequestError("Invalid credentials");

  return { token: signToken(user.id) };
};

export const googleLogin = async (email: string) => {
  const user = await userRepo.findUserByEmail(email);
  if (!user) throw new NotFoundError("User not found");
  return { token: signToken(user.id) };
};

export const register = async (
  data: TRegistrationSchema,
  files: UploadedFile[]
) => {
  if (!files.length) throw new BadRequestError("At least one image is required");

  const passwordHash = await bcrypt.hash(data.password, 10);
  const geohash = ngeohash.encode(data.latitude, data.longitude, 4);
  const age = calculateAge(data.date_of_birth);
  const bloomFilter = new BitSet().toString();

  const user = await userRepo.createUserWithImagesAndBehaviours(
    { ...data, passwordHash, geohash, bloomFilter, age },
    files.map((f) => ({ url: f.location }))
  );

  return { token: signToken(user.id) };
};

export const likeImage = async (userId: number, body: TImageLikedSchema) => {
  const user = await userRepo.findUserById(userId);
  if (!user) throw new NotFoundError("User not found");

  const updatedBloom = addToBloomFilter(user.bloom_filter, body.likedUserId);
  await userRepo.createImageLike(
    userId,
    body.likedUserId,
    body.imageId,
    body.comment,
    updatedBloom
  );
};

export const likeBehaviour = async (
  userId: number,
  body: TBehaviourLikedSchema
) => {
  const user = await userRepo.findUserById(userId);
  if (!user) throw new NotFoundError("User not found");

  const updatedBloom = addToBloomFilter(user.bloom_filter, body.likedUserId);
  await userRepo.createBehaviourLike(
    userId,
    body.likedUserId,
    body.behaviourId,
    body.comment,
    updatedBloom
  );
};

export const reject = async (userId: number, body: TRejectSchema) => {
  const user = await userRepo.findUserById(userId);
  if (!user) throw new NotFoundError("User not found");

  const updatedBloom = addToBloomFilter(user.bloom_filter, body.rejectedUserId);
  await userRepo.rejectUser(userId, body.rejectedUserId, updatedBloom);
};

export const accept = async (userId: number, body: TAcceptSchema) => {
  const user = await userRepo.findUserById(userId);
  if (!user) throw new NotFoundError("User not found");

  const otherUser = await userRepo.findUserById(body.acceptedUserId);
  if (!otherUser) throw new NotFoundError("User not found");

  const updatedBloom = addToBloomFilter(user.bloom_filter, body.acceptedUserId);
  await userRepo.acceptUser(userId, body.acceptedUserId, updatedBloom, body.message);
};

export const getAllLikes = async (userId: number) => {
  const user = await userRepo.findUserById(userId);
  if (!user) throw new NotFoundError("User not found");
  return userRepo.getLikesReceived(userId);
};

export const getMe = async (userId: number) => {
  const user = await userRepo.getUserProfile(userId);
  if (!user) throw new NotFoundError("User not found");
  return user;
};

export const getProfile = async (userId: number, otherUserId: number) => {
  const user = await userRepo.findUserById(userId);
  if (!user) throw new NotFoundError("User not found");

  const like = await userRepo.checkLikeExists(otherUserId, userId);
  if (!like) throw new ForbiddenError("Not authorized to view this profile");

  const profile = await userRepo.getUserProfile(otherUserId);
  if (!profile) throw new NotFoundError("Profile not found");

  return profile;
};

export const getChats = async (userId: number, otherUserId: number) => {
  const [user, other] = await Promise.all([
    userRepo.findUserById(userId),
    userRepo.findUserById(otherUserId),
  ]);
  if (!user || !other) throw new NotFoundError("User not found");
  return userRepo.getChatsBetweenUsers(userId, otherUserId);
};

export const getAllMatches = async (userId: number) => {
  const user = await userRepo.getAllMatchesForUser(userId);
  if (!user) throw new NotFoundError("User not found");

  const people = new Map<number, unknown>();
  user.matches_accepted.forEach((m) => people.set(m.first_person.id, m.first_person));
  user.matches_initiated.forEach((m) => people.set(m.second_person.id, m.second_person));

  return { people: Array.from(people.values()), id: user.id };
};

export const getMatches = async (userId: number) => {
  const user = await userRepo.findUserById(userId);
  if (!user) throw new NotFoundError("User not found");

  const neighbours = ngeohash.neighbors(user.geohash);
  let geohashes = [user.geohash];
  for (const n of Object.values(neighbours)) {
    geohashes = [...geohashes, ...Object.values(ngeohash.neighbors(n))];
  }

  const results = await userRepo.getNearbyUsers(
    userId,
    geohashes,
    Number(user.latitude),
    Number(user.longitude),
    user.preferred_gender
  );

  return results.filter((r) => !existsInBloomFilter(user.bloom_filter, r.id));
};
