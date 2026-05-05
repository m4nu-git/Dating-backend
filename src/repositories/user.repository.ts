import prisma from "../db";
import { TRegistrationSchema } from "../validators/user.validator";

type RegisterData = TRegistrationSchema & {
  passwordHash: string;
  geohash: string;
  bloomFilter: string;
  age: number;
};

type UploadedImage = { url: string };

export const findUserByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email } });

export const findUserById = (id: number) =>
  prisma.user.findUnique({ where: { id } });

export const getUserProfile = (id: number) =>
  prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone_number: true,
      age: true,
      gender: true,
      preferred_gender: true,
      occupation: true,
      region: true,
      religion: true,
      date_of_birth: true,
      home_town: true,
      dating_type: true,
      images: { select: { url: true, id: true } },
      behaviours: { select: { question: true, answer: true, id: true } },
    },
  });

export const createUserWithImagesAndBehaviours = async (
  data: RegisterData,
  images: UploadedImage[]
) => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        password: data.passwordHash,
        phone_number: data.phoneNumber,
        age: data.age,
        gender: data.gender,
        preferred_gender: data.preferredGender,
        latitude: data.latitude,
        longitude: data.longitude,
        dating_type: data.dating_type,
        occupation: data.occupation,
        region: data.region,
        religion: data.religion,
        date_of_birth: data.date_of_birth,
        home_town: data.home_town,
        geohash: data.geohash,
        bloom_filter: data.bloomFilter,
      },
    });

    await tx.images.createMany({
      data: images.map((img) => ({ url: img.url, user_id: user.id })),
    });

    if (data.behaviours?.length) {
      await tx.behaviour.createMany({
        data: data.behaviours.map((b) => ({
          question: b.question,
          answer: b.answer,
          user_id: user.id,
        })),
      });
    }

    return user;
  });
};

export const updateBloomFilter = (userId: number, bloomFilter: string) =>
  prisma.user.update({
    where: { id: userId },
    data: { bloom_filter: bloomFilter },
  });

export const createImageLike = async (
  likedBy: number,
  likedTo: number,
  imageId: number,
  comment: string,
  updatedBloom: string
) => {
  return prisma.$transaction(async (tx) => {
    await tx.likes.create({
      data: { image_id: imageId, liked_by: likedBy, liked_to: likedTo, comment },
    });
    await tx.user.update({
      where: { id: likedBy },
      data: { bloom_filter: updatedBloom },
    });
  });
};

export const createBehaviourLike = async (
  likedBy: number,
  likedTo: number,
  behaviourId: number,
  comment: string,
  updatedBloom: string
) => {
  return prisma.$transaction(async (tx) => {
    await tx.likes.create({
      data: { behaviour_id: behaviourId, liked_by: likedBy, liked_to: likedTo, comment },
    });
    await tx.user.update({
      where: { id: likedBy },
      data: { bloom_filter: updatedBloom },
    });
  });
};

export const rejectUser = async (
  userId: number,
  rejectedUserId: number,
  updatedBloom: string
) => {
  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { bloom_filter: updatedBloom },
    });
    await tx.likes.deleteMany({
      where: { liked_by: rejectedUserId, liked_to: userId },
    });
  });
};

export const acceptUser = async (
  userId: number,
  acceptedUserId: number,
  updatedBloom: string,
  firstMessage: string
) => {
  return prisma.$transaction(async (tx) => {
    await tx.likes.deleteMany({
      where: { liked_by: acceptedUserId, liked_to: userId },
    });
    await tx.user.update({
      where: { id: userId },
      data: { bloom_filter: updatedBloom },
    });
    await tx.matches.create({
      data: { first_person_id: acceptedUserId, second_person_id: userId },
    });
    await tx.chats.create({
      data: { sender_id: userId, receiver_id: acceptedUserId, message: firstMessage },
    });
  });
};

export const checkLikeExists = (likedBy: number, likedTo: number) =>
  prisma.likes.findUnique({
    where: { liked_by_liked_to: { liked_by: likedBy, liked_to: likedTo } },
  });

export const getLikesReceived = (userId: number) =>
  prisma.likes.findMany({
    where: { liked_to: userId },
    include: {
      by_user: {
        select: {
          id: true,
          first_name: true,
          images: { select: { url: true } },
        },
      },
      image: { select: { url: true, id: true } },
      behaviour: { select: { question: true, answer: true, id: true } },
    },
  });

export const getChatsBetweenUsers = async (userId: number, otherUserId: number) => {
  const [sent, received] = await prisma.$transaction([
    prisma.chats.findMany({
      where: { sender_id: userId, receiver_id: otherUserId },
    }),
    prisma.chats.findMany({
      where: { sender_id: otherUserId, receiver_id: userId },
    }),
  ]);
  return [...sent, ...received].sort(
    (a, b) => a.created_at.getTime() - b.created_at.getTime()
  );
};

export const saveChat = (senderId: number, receiverId: number, message: string) =>
  prisma.chats.create({ data: { sender_id: senderId, receiver_id: receiverId, message } });

export const getAllMatchesForUser = (userId: number) =>
  prisma.user.findUnique({
    where: { id: userId },
    include: {
      matches_accepted: {
        select: {
          id: true,
          first_person: {
            select: {
              id: true,
              first_name: true,
              images: { select: { id: true, url: true } },
              chats_sent: {
                take: 1,
                orderBy: { created_at: "desc" },
                select: { message: true, created_at: true },
              },
              chats_received: {
                take: 1,
                orderBy: { created_at: "desc" },
                select: { message: true, created_at: true },
              },
            },
          },
        },
      },
      matches_initiated: {
        select: {
          second_person: {
            select: {
              id: true,
              first_name: true,
              images: { select: { id: true, url: true } },
              chats_sent: {
                take: 1,
                orderBy: { created_at: "desc" },
                select: { message: true, created_at: true },
              },
              chats_received: {
                take: 1,
                orderBy: { created_at: "desc" },
                select: { message: true, created_at: true },
              },
            },
          },
        },
      },
    },
  });

export const getNearbyUsers = async (
  currentUserId: number,
  geohashes: string[],
  lat: number,
  lng: number,
  preferredGender: string
) => {
  return prisma.$queryRaw<
    {
      id: number;
      first_name: string;
      last_name: string;
      age: number;
      gender: string;
      occupation: string;
      images: unknown;
      behaviours: unknown;
    }[]
  >`
    SELECT
      "User".id,
      "User".first_name,
      "User".last_name,
      "User".age,
      "User".gender,
      "User".occupation,
      "User".region,
      "User".religion,
      "User".dating_type,
      "User".home_town,
      json_agg(DISTINCT "Images") AS images,
      json_agg(DISTINCT "Behaviour") AS behaviours
    FROM "User"
    LEFT JOIN "Images"    ON "User".id = "Images".user_id
    LEFT JOIN "Behaviour" ON "User".id = "Behaviour".user_id
    WHERE
      geohash = ANY(${geohashes})
      AND "User".id != ${currentUserId}
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint("User".longitude::double precision, "User".latitude::double precision), 4326),
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        100 * 1000
      )
      AND "User".gender = ${preferredGender}
    GROUP BY "User".id
    LIMIT 10;
  `;
};
