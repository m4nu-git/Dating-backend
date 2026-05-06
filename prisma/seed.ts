import "dotenv/config";
import bcrypt from "bcrypt";
import BitSet from "bitset";
import ngeohash from "ngeohash";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PASSWORD = "password123";
const BLANK_BLOOM = new BitSet().toString();

const users = [
  {
    first_name: "Arjun",
    last_name: "Sharma",
    email: "arjun@example.com",
    phone_number: "9811001001",
    gender: "male",
    preferred_gender: "female",
    latitude: "28.6139",
    longitude: "77.2090",
    occupation: "Software Engineer",
    region: "Delhi",
    religion: "Hindu",
    date_of_birth: "10-05-1997",
    home_town: "Delhi",
    dating_type: "serious",
    behaviours: [
      { question: "What are you looking for?", answer: "A long-term relationship" },
      { question: "Describe yourself in 3 words", answer: "Calm, curious, kind" },
    ],
    image_url: "https://picsum.photos/seed/arjun/400/600",
  },
  {
    first_name: "Rohan",
    last_name: "Verma",
    email: "rohan@example.com",
    phone_number: "9811002002",
    gender: "male",
    preferred_gender: "female",
    latitude: "28.5355",
    longitude: "77.3910",
    occupation: "Product Manager",
    region: "Noida",
    religion: "Hindu",
    date_of_birth: "22-11-1996",
    home_town: "Noida",
    dating_type: "casual",
    behaviours: [
      { question: "What are you looking for?", answer: "Meeting new people" },
      { question: "Your ideal weekend?", answer: "Hiking and coffee" },
    ],
    image_url: "https://picsum.photos/seed/rohan/400/600",
  },
  {
    first_name: "Priya",
    last_name: "Kapoor",
    email: "priya@example.com",
    phone_number: "9811003003",
    gender: "female",
    preferred_gender: "male",
    latitude: "28.7041",
    longitude: "77.1025",
    occupation: "UX Designer",
    region: "Rohini",
    religion: "Hindu",
    date_of_birth: "05-03-1999",
    home_town: "Delhi",
    dating_type: "serious",
    behaviours: [
      { question: "What are you looking for?", answer: "Someone genuine and caring" },
      { question: "Describe yourself in 3 words", answer: "Creative, empathetic, driven" },
    ],
    image_url: "https://picsum.photos/seed/priya/400/600",
  },
  {
    first_name: "Sneha",
    last_name: "Mehta",
    email: "sneha@example.com",
    phone_number: "9811004004",
    gender: "female",
    preferred_gender: "male",
    latitude: "28.4595",
    longitude: "77.0266",
    occupation: "Doctor",
    region: "Gurgaon",
    religion: "Hindu",
    date_of_birth: "18-07-1998",
    home_town: "Gurgaon",
    dating_type: "serious",
    behaviours: [
      { question: "What are you looking for?", answer: "A meaningful connection" },
      { question: "Your ideal weekend?", answer: "Reading and cooking" },
    ],
    image_url: "https://picsum.photos/seed/sneha/400/600",
  },
];

async function main() {
  console.log("Clearing existing seed data...");
  await prisma.behaviour.deleteMany();
  await prisma.images.deleteMany();
  await prisma.likes.deleteMany();
  await prisma.chats.deleteMany();
  await prisma.matches.deleteMany();
  await prisma.user.deleteMany();

  console.log("Seeding users...\n");

  for (const u of users) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const geohash = ngeohash.encode(parseFloat(u.latitude), parseFloat(u.longitude), 4);

    const [day, month, year] = u.date_of_birth.split("-").map(Number);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const hasBirthday =
      today.getMonth() > birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
    if (!hasBirthday) age--;

    const user = await prisma.user.create({
      data: {
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        password: passwordHash,
        phone_number: u.phone_number,
        gender: u.gender,
        preferred_gender: u.preferred_gender,
        latitude: u.latitude,
        longitude: u.longitude,
        occupation: u.occupation,
        region: u.region,
        religion: u.religion,
        date_of_birth: u.date_of_birth,
        home_town: u.home_town,
        dating_type: u.dating_type,
        age,
        geohash,
        bloom_filter: BLANK_BLOOM,
      },
    });

    await prisma.images.create({
      data: { url: u.image_url, user_id: user.id },
    });

    await prisma.behaviour.createMany({
      data: u.behaviours.map((b) => ({ ...b, user_id: user.id })),
    });

    console.log(`✓ ${u.first_name} ${u.last_name} (${u.gender}) | id: ${user.id} | geohash: ${geohash} | age: ${age}`);
  }

  console.log("\nAll users seeded. Password for all: password123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
