import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const GoogleLoginSchema = z.object({
  email: z.string().email(),
});

export const RegistrationSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  password: z.string(),
  gender: z.string(),
  phoneNumber: z.string(),
  preferredGender: z.string(),
  latitude: z.string(),
  longitude: z.string(),
  occupation: z.string(),
  region: z.string(),
  religion: z.string(),
  date_of_birth: z.string(),
  home_town: z.string(),
  dating_type: z.string(),
  behaviours: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .optional(),
});

export const ImageLikedSchema = z.object({
  likedUserId: z.number(),
  imageId: z.number(),
  comment: z.string(),
});

export const BehaviourLikedSchema = z.object({
  likedUserId: z.number(),
  behaviourId: z.number(),
  comment: z.string(),
});

export const RejectSchema = z.object({
  rejectedUserId: z.number(),
});

export const AcceptSchema = z.object({
  acceptedUserId: z.number(),
  message: z.string(),
});

export type TRegistrationSchema = z.infer<typeof RegistrationSchema>;
export type TLoginSchema = z.infer<typeof LoginSchema>;
export type TImageLikedSchema = z.infer<typeof ImageLikedSchema>;
export type TBehaviourLikedSchema = z.infer<typeof BehaviourLikedSchema>;
export type TRejectSchema = z.infer<typeof RejectSchema>;
export type TAcceptSchema = z.infer<typeof AcceptSchema>;
